import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  Loader2,
  Plus,
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  AlertCircle,
  Activity,
  Share2,
  Sparkles,
  ExternalLink,
  Lightbulb,
  BookOpen,
  PlusCircle,
} from "lucide-react";
import { Link } from "wouter";
import type {
  SurvivorshipProfile,
  FollowUpSchedule,
  LateEffectWatchlistItem,
  SurvivorshipPhase,
  SurvivorshipFollowUpFrequency,
  FollowUpCategory,
  LateEffectType,
  SeverityLevel,
} from "@shared/schema";
import {
  survivorshipPhaseLabels,
  survivorshipFollowUpFrequencies,
  survivorshipFollowUpFrequencyLabels,
  followUpCategories,
  followUpCategoryLabels,
  lateEffectTypes,
  lateEffectLabels,
  survivorshipTreatmentTypes,
  survivorshipTreatmentTypeLabels,
  severityLevels,
  severityLabels,
} from "@shared/schema";

interface TimelineData {
  profile: SurvivorshipProfile & {
    currentPhase: SurvivorshipPhase;
    yearsSinceTreatment: number;
  };
  phases: Array<{
    phase: SurvivorshipPhase;
    label: string;
    description: string;
    years: string;
    startYear: number;
    endYear: number;
    isCurrent: boolean;
    isPast: boolean;
  }>;
  milestones: Array<{
    date: string;
    label: string;
    type: string;
    yearsFromEnd: number;
  }>;
}

interface DashboardData {
  hasProfile: boolean;
  profile?: SurvivorshipProfile & {
    currentPhase: SurvivorshipPhase;
    yearsSinceTreatment: number;
  };
  summary?: {
    totalFollowUps: number;
    overdueCount: number;
    upcomingCount: number;
    watchingEffectsCount: number;
    detectedEffectsCount: number;
  };
  overdueFollowUps?: FollowUpSchedule[];
  upcomingFollowUps?: FollowUpSchedule[];
  detectedEffects?: LateEffectWatchlistItem[];
}

interface FollowUpWithStatus extends FollowUpSchedule {
  isOverdue?: boolean;
  daysUntilDue?: number;
}

interface LateEffectSuggestion {
  id: string;
  effectType: LateEffectType;
  effectLabel: string;
  relatedTreatments: string[];
  reason: string;
  priority: "high" | "medium" | "low";
  monitoringTips: string[];
  relatedResourceCategories: string[];
  isAlreadyWatching: boolean;
}

interface PersonalizedWatchlistResponse {
  suggestions: LateEffectSuggestion[];
  aiGenerated: boolean;
  disclaimer: string;
  basedOn: {
    treatments: string[];
    cancerType: string;
    yearsSinceTreatment: number;
    reportedSymptoms: string[];
  };
}

const priorityColors = {
  high: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
};

const categoryIcons: Record<string, typeof BookOpen> = {
  educational_materials: BookOpen,
  mental_health: Heart,
  clinical_trials: Stethoscope,
  community_forums: Activity,
  nutritional_support: Target,
  advocacy_groups: Shield,
  caregiver_support: Heart,
};

export default function Survivorship() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddFollowUpDialog, setShowAddFollowUpDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpSchedule | null>(null);
  const { toast } = useToast();

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/survivorship/dashboard"],
  });

  const { data: timeline } = useQuery<TimelineData>({
    queryKey: ["/api/survivorship/timeline", dashboard?.profile?.id],
    enabled: !!dashboard?.profile?.id,
  });

  const { data: followUps } = useQuery<FollowUpWithStatus[]>({
    queryKey: ["/api/survivorship/follow-ups"],
  });

  const { data: lateEffects } = useQuery<LateEffectWatchlistItem[]>({
    queryKey: ["/api/survivorship/late-effects"],
  });

  // Personalized watchlist mutation
  const personalizedWatchlistMutation = useMutation({
    mutationFn: async (survivorshipProfileId: string) => {
      const response = await apiRequest("POST", "/api/survivorship/personalized-watchlist", {
        survivorshipProfileId,
        reportedSymptoms: [],
      });
      return response.json() as Promise<PersonalizedWatchlistResponse>;
    },
  });

  // Add effect to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (data: { survivorshipProfileId: string; effectType: string; relatedTreatment?: string }) => {
      return apiRequest("POST", "/api/survivorship/late-effects/add-from-suggestion", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/late-effects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/dashboard"] });
      if (dashboard?.profile?.id) {
        personalizedWatchlistMutation.mutate(dashboard.profile.id);
      }
      toast({ title: "Added to watchlist", description: "The effect has been added to your monitoring list." });
    },
  });

  const phaseColors: Record<SurvivorshipPhase, string> = {
    high_intensity: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    medium_intensity: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
    low_intensity: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  };

  const statusColors = {
    watching: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
    detected: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
    resolved: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  };

  if (loadingDashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!dashboard?.hasProfile) {
    return (
      <div className="container max-w-4xl py-6 px-4">
        <Alert className="bg-amber-500/10 border-amber-500/30 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>NOT medical advice.</strong> This tool helps you track survivorship milestones and follow-ups.
            Always consult your healthcare provider for medical guidance.
          </AlertDescription>
        </Alert>
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome to Survivorship</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Track your cancer survivorship journey, follow-up appointments, and late effect monitoring
              for years 0-10+ after treatment.
            </p>
            <Button size="lg" data-testid="button-setup-survivorship">
              <Plus className="h-4 w-4 mr-2" />
              Set Up Survivorship Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> This tool helps you track survivorship milestones and follow-ups.
          Always consult your healthcare provider for medical guidance.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Heart className="h-8 w-8 text-primary" />
            My Follow-ups
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {dashboard.profile?.cancerType} - Year {dashboard.profile?.yearsSinceTreatment || 0}+ Journey
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`text-sm px-3 py-1 ${phaseColors[dashboard.profile?.currentPhase || "high_intensity"]}`}>
            {survivorshipPhaseLabels[dashboard.profile?.currentPhase || "high_intensity"]}
          </Badge>
          <div className="flex items-center gap-2">
            <Button size="sm" data-testid="button-add-followup">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Button size="sm" variant="outline" asChild data-testid="button-export-followups">
              <Link href="/care-packets">
                <Share2 className="h-4 w-4 mr-1" />
                Export
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {dashboard.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.profile?.yearsSinceTreatment || 0}</div>
              <p className="text-sm text-muted-foreground">Years Since Treatment</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.summary.totalFollowUps}</div>
              <p className="text-sm text-muted-foreground">Scheduled Follow-ups</p>
            </CardContent>
          </Card>
          <Card className={dashboard.summary.overdueCount > 0 ? "border-red-500/50" : ""}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${dashboard.summary.overdueCount > 0 ? "text-red-600" : ""}`}>
                {dashboard.summary.overdueCount}
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard.summary.watchingEffectsCount}</div>
              <p className="text-sm text-muted-foreground">Late Effects Watching</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{dashboard.summary.detectedEffectsCount}</div>
              <p className="text-sm text-muted-foreground">Effects Detected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="min-h-[44px]" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="min-h-[44px]" data-testid="tab-follow-ups">
            <Calendar className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Follow-ups</span>
          </TabsTrigger>
          <TabsTrigger value="late-effects" className="min-h-[44px]" data-testid="tab-late-effects">
            <Eye className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Late Effects</span>
          </TabsTrigger>
          <TabsTrigger value="daily-metrics" className="min-h-[44px]" data-testid="tab-daily-metrics">
            <Activity className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Daily</span>
          </TabsTrigger>
          <TabsTrigger value="symptoms" className="min-h-[44px]" data-testid="tab-symptoms">
            <AlertCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Symptoms</span>
          </TabsTrigger>
          <TabsTrigger value="wellness" className="min-h-[44px]" data-testid="tab-wellness">
            <Heart className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">QoL</span>
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="min-h-[44px]" data-testid="tab-ai-insights">
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {timeline && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Survivorship Timeline
                  </CardTitle>
                  <CardDescription>
                    Your journey from treatment completion through long-term survivorship
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {timeline.phases.map((phase, idx) => (
                    <div
                      key={phase.phase}
                      className={`p-4 rounded-lg border transition-all ${
                        phase.isCurrent
                          ? "ring-2 ring-primary bg-primary/5"
                          : phase.isPast
                          ? "opacity-60"
                          : ""
                      }`}
                      data-testid={`phase-${phase.phase}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{phase.label}</span>
                            <span className="text-sm text-muted-foreground">({phase.years})</span>
                            {phase.isCurrent && (
                              <Badge className={phaseColors[phase.phase]}>Current</Badge>
                            )}
                            {phase.isPast && (
                              <Badge variant="outline" className="text-green-600 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{phase.description}</p>
                        </div>
                        <div className="text-right text-sm">
                          {phase.isCurrent && (
                            <span className="text-primary font-medium">
                              Year {timeline.profile.yearsSinceTreatment}
                            </span>
                          )}
                        </div>
                      </div>
                      {phase.isCurrent && (
                        <div className="mt-3">
                          <Progress
                            value={Math.min(
                              ((timeline.profile.yearsSinceTreatment - phase.startYear) /
                                (phase.endYear - phase.startYear)) *
                                100,
                              100
                            )}
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {timeline.milestones.map((milestone, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-3 rounded-lg border ${
                          milestone.type === "upcoming_anniversary"
                            ? "border-dashed opacity-70"
                            : ""
                        }`}
                      >
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            milestone.type === "diagnosis"
                              ? "bg-red-500/20"
                              : milestone.type === "treatment_end"
                              ? "bg-green-500/20"
                              : milestone.type === "anniversary"
                              ? "bg-primary/20"
                              : "bg-muted"
                          }`}
                        >
                          {milestone.type === "diagnosis" ? (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          ) : milestone.type === "treatment_end" ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <Heart className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{milestone.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(milestone.date).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="follow-ups" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Follow-up Schedule</h2>
              <p className="text-muted-foreground">
                Configure and track your recurring follow-up appointments
              </p>
            </div>
            <Button onClick={() => setShowAddFollowUpDialog(true)} data-testid="button-add-followup">
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add Follow-up
            </Button>
          </div>

          {followUps && followUps.length > 0 ? (
            <div className="space-y-3">
              {followUps.map((fu) => (
                <Card
                  key={fu.id}
                  className={fu.isOverdue ? "border-red-500/50" : ""}
                  data-testid={`followup-${fu.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{fu.title}</span>
                          <Badge variant="outline">{followUpCategoryLabels[fu.category]}</Badge>
                          {fu.isOverdue ? (
                            <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          ) : fu.daysUntilDue !== undefined && fu.daysUntilDue <= 30 ? (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Due Soon
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            Next due: {new Date(fu.nextDueDate).toLocaleDateString()}
                            {fu.daysUntilDue !== undefined && (
                              <span>
                                ({fu.isOverdue ? `${Math.abs(fu.daysUntilDue)} days overdue` : `in ${fu.daysUntilDue} days`})
                              </span>
                            )}
                          </p>
                          <p>Frequency: {survivorshipFollowUpFrequencyLabels[fu.frequency as SurvivorshipFollowUpFrequency]}</p>
                          {fu.lastCompletedDate && (
                            <p>Last completed: {new Date(fu.lastCompletedDate).toLocaleDateString()}</p>
                          )}
                        </div>
                        {fu.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{fu.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFollowUp(fu);
                          setShowCompleteDialog(true);
                        }}
                        data-testid={`button-complete-${fu.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Follow-ups Scheduled</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first follow-up appointment to start tracking
                </p>
                <Button onClick={() => setShowAddFollowUpDialog(true)} data-testid="button-add-first-followup">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Add First Follow-up
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="late-effects" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Personalized Late Effects Watchlist
              </h2>
              <p className="text-muted-foreground">
                Effects to monitor based on your treatment history - for awareness, not diagnosis
              </p>
            </div>
            <Button
              onClick={() => dashboard?.profile?.id && personalizedWatchlistMutation.mutate(dashboard.profile.id)}
              disabled={personalizedWatchlistMutation.isPending || !dashboard?.profile?.id}
              data-testid="button-analyze-late-effects"
            >
              {personalizedWatchlistMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Analyze My Treatments
                </>
              )}
            </Button>
          </div>

          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200" data-testid="text-late-effects-disclaimer">
              <strong>NOT medical advice.</strong> This watchlist shows late effects commonly associated with your 
              documented treatments. This is educational information only - it does not indicate you have these 
              conditions. Always discuss any concerns with your healthcare provider.
            </AlertDescription>
          </Alert>

          {/* Personalized Suggestions Section */}
          {personalizedWatchlistMutation.data && (
            <Card data-testid="card-personalized-suggestions">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Suggested Effects to Monitor
                    </CardTitle>
                    <CardDescription>
                      Based on: {personalizedWatchlistMutation.data.basedOn.treatments.map(
                        (t) => survivorshipTreatmentTypeLabels[t as keyof typeof survivorshipTreatmentTypeLabels] || t
                      ).join(", ")}
                    </CardDescription>
                  </div>
                  {personalizedWatchlistMutation.data.aiGenerated && (
                    <Badge 
                      className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30"
                      data-testid="badge-ai-enhanced"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI-Enhanced
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {personalizedWatchlistMutation.data.suggestions.filter(s => !s.isAlreadyWatching).length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground" data-testid="text-all-suggestions-complete">
                    <Check className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p>All suggested effects are already on your watchlist!</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {personalizedWatchlistMutation.data.suggestions
                      .filter(s => !s.isAlreadyWatching)
                      .map((suggestion) => (
                        <Card key={suggestion.id} data-testid={`suggestion-${suggestion.effectType}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium" data-testid={`text-suggestion-name-${suggestion.effectType}`}>
                                  {suggestion.effectLabel}
                                </h4>
                                <Badge className={priorityColors[suggestion.priority]} data-testid={`badge-priority-${suggestion.effectType}`}>
                                  {suggestion.priority} priority
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => addToWatchlistMutation.mutate({
                                  survivorshipProfileId: dashboard?.profile?.id || "",
                                  effectType: suggestion.effectType,
                                  relatedTreatment: suggestion.relatedTreatments[0],
                                })}
                                disabled={addToWatchlistMutation.isPending}
                                data-testid={`button-add-${suggestion.effectType}`}
                              >
                                <PlusCircle className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                            
                            <p className="text-sm text-muted-foreground" data-testid={`text-suggestion-reason-${suggestion.effectType}`}>
                              {suggestion.reason}
                            </p>

                            {suggestion.monitoringTips.length > 0 && (
                              <div className="text-sm" data-testid={`tips-section-${suggestion.effectType}`}>
                                <p className="font-medium mb-1">Tracking tips:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-0.5" data-testid={`tips-list-${suggestion.effectType}`}>
                                  {suggestion.monitoringTips.slice(0, 2).map((tip, idx) => (
                                    <li key={idx} data-testid={`tip-${suggestion.effectType}-${idx}`}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {suggestion.relatedResourceCategories.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Related resources:</span>
                                {suggestion.relatedResourceCategories.slice(0, 3).map((cat) => (
                                  <Link
                                    key={cat}
                                    href={`/support-resources?category=${cat}`}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    data-testid={`link-resource-${suggestion.effectType}-${cat}`}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {cat.replace(/_/g, " ")}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Current Watchlist */}
          <div data-testid="section-current-watchlist">
            <h3 className="text-lg font-semibold mb-2">Your Current Watchlist</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Effects you are currently monitoring
            </p>
          </div>

          <Alert className="bg-blue-500/10 border-blue-500/30" data-testid="alert-watchlist-guidance">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              These are effects you've chosen to monitor. Status changes (watching → detected → resolved) 
              should be updated in consultation with your healthcare provider.
            </AlertDescription>
          </Alert>

          {lateEffects && lateEffects.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {lateEffects.map((effect) => (
                <Card key={effect.id} data-testid={`late-effect-${effect.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">
                            {effect.effectType === "other" && effect.customEffectName
                              ? effect.customEffectName
                              : lateEffectLabels[effect.effectType]}
                          </span>
                          <Badge className={statusColors[effect.status]}>
                            {effect.status === "watching" && <Eye className="h-3 w-3 mr-1" />}
                            {effect.status === "detected" && <AlertCircle className="h-3 w-3 mr-1" />}
                            {effect.status === "resolved" && <Check className="h-3 w-3 mr-1" />}
                            {effect.status.charAt(0).toUpperCase() + effect.status.slice(1)}
                          </Badge>
                          {effect.severity && (
                            <Badge variant="outline">
                              {severityLabels[effect.severity as SeverityLevel]}
                            </Badge>
                          )}
                        </div>
                        {effect.relatedTreatment && (
                          <p className="text-sm text-muted-foreground">
                            Related to: {survivorshipTreatmentTypeLabels[effect.relatedTreatment]}
                          </p>
                        )}
                        {effect.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{effect.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Late Effects on Watchlist</h3>
                <p className="text-muted-foreground">
                  Late effects will be suggested based on your treatment history
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="daily-metrics" className="space-y-6 mt-6">
          <DailyWellnessMetrics profileId={dashboard.profile?.profileId} />
        </TabsContent>

        <TabsContent value="symptoms" className="space-y-6 mt-6">
          <SymptomJournal profileId={dashboard.profile?.profileId} />
        </TabsContent>

        <TabsContent value="wellness" className="space-y-6 mt-6">
          <WellnessTracking profileId={dashboard.profile?.profileId} />
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6 mt-6">
          <AISurvivorshipInsights profileId={dashboard.profile?.profileId} />
        </TabsContent>
      </Tabs>

      <AddFollowUpDialog
        open={showAddFollowUpDialog}
        onOpenChange={setShowAddFollowUpDialog}
        survivorshipProfileId={dashboard.profile?.id || ""}
      />

      {selectedFollowUp && (
        <CompleteFollowUpDialog
          open={showCompleteDialog}
          onOpenChange={setShowCompleteDialog}
          followUp={selectedFollowUp}
        />
      )}
    </div>
  );
}

function AddFollowUpDialog({
  open,
  onOpenChange,
  survivorshipProfileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survivorshipProfileId: string;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FollowUpCategory>("oncology");
  const [frequency, setFrequency] = useState<SurvivorshipFollowUpFrequency>("annually");
  const [customDays, setCustomDays] = useState("");
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/survivorship/follow-ups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/dashboard"] });
      toast({ title: "Follow-up added", description: "Your follow-up schedule has been saved." });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setTitle("");
    setCategory("oncology");
    setFrequency("annually");
    setCustomDays("");
    setNextDueDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Follow-up Schedule</DialogTitle>
          <DialogDescription>
            Schedule a recurring follow-up appointment or screening
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fu-title">Title *</Label>
            <Input
              id="fu-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Annual Oncology Follow-up"
              data-testid="input-followup-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fu-category">Category *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as FollowUpCategory)}>
              <SelectTrigger data-testid="select-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {followUpCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {followUpCategoryLabels[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fu-frequency">Frequency *</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as SurvivorshipFollowUpFrequency)}>
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {survivorshipFollowUpFrequencies.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {survivorshipFollowUpFrequencyLabels[freq]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {frequency === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-days">Custom Interval (days)</Label>
              <Input
                id="custom-days"
                type="number"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="e.g., 45"
                data-testid="input-custom-days"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="next-due">Next Due Date *</Label>
            <Input
              id="next-due"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              data-testid="input-next-due"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fu-notes">Notes (optional)</Label>
            <Textarea
              id="fu-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              data-testid="input-followup-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-cancel-followup">
            Cancel
          </Button>
          <Button
            onClick={() => {
              addMutation.mutate({
                profileId: "profile-default",
                survivorshipProfileId,
                title,
                category,
                frequency,
                customIntervalDays: frequency === "custom" ? parseInt(customDays) : undefined,
                startDate: new Date().toISOString().split("T")[0],
                nextDueDate,
                isActive: true,
                notes: notes || undefined,
              });
            }}
            disabled={addMutation.isPending || !title || !nextDueDate}
            data-testid="button-submit-followup"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteFollowUpDialog({
  open,
  onOpenChange,
  followUp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUpSchedule;
}) {
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState("");
  const { toast } = useToast();

  const completeMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", `/api/survivorship/follow-ups/${followUp.id}/complete`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/dashboard"] });
      toast({ title: "Follow-up completed", description: "Next due date has been updated." });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Follow-up Complete</DialogTitle>
          <DialogDescription>
            Record completion of: {followUp.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="completed-date">Completed Date</Label>
            <Input
              id="completed-date"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              data-testid="input-completed-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="complete-results">Results Summary (optional)</Label>
            <Textarea
              id="complete-results"
              value={results}
              onChange={(e) => setResults(e.target.value)}
              placeholder="e.g., All clear, no concerns..."
              rows={2}
              data-testid="input-results"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="complete-notes">Notes (optional)</Label>
            <Textarea
              id="complete-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              data-testid="input-complete-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-complete">
            Cancel
          </Button>
          <Button
            onClick={() => {
              completeMutation.mutate({
                completedDate,
                notes: notes || undefined,
                results: results || undefined,
              });
            }}
            disabled={completeMutation.isPending}
            data-testid="button-submit-complete"
          >
            {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AISurvivorshipCarePlan {
  id: string;
  overviewSummary: string;
  immediateFollowUpNeeds: Array<{
    category: string;
    title: string;
    frequency: string;
    rationale: string;
    priority: "high" | "medium" | "low";
  }>;
  longTermMonitoring: Array<{
    area: string;
    recommendation: string;
    startingWhen: string;
    frequency: string;
  }>;
  lifestyleRecommendations: Array<{
    category: string;
    recommendation: string;
    benefit: string;
  }>;
  mentalHealthSupport: Array<{
    concern: string;
    recommendation: string;
    resources: string[];
  }>;
  aiConfidence: number;
  disclaimer: string;
}

interface AIFollowUpSummary {
  id: string;
  overdueSummary: string;
  upcomingSummary: string;
  discussionPoints: Array<{
    topic: string;
    timeframe: "discuss_soon" | "upcoming" | "routine";
    reason: string;
    suggestedDate?: string;
  }>;
  screeningRecommendations: Array<{
    screening: string;
    frequency: string;
    lastCompleted?: string;
    nextDue: string;
    importance: string;
  }>;
  adherenceInsights: {
    completionRate: number;
    trend: "improving" | "stable" | "declining";
    suggestion: string;
  };
  aiConfidence: number;
  disclaimer: string;
}

interface AILateEffectAnalysis {
  id: string;
  potentialLateEffects: Array<{
    effectType: string;
    relatedTreatments: string[];
    riskLevel: "low" | "moderate" | "high";
    typicalOnsetTime: string;
    symptoms: string[];
    discussionTopics: string[];
    preventiveMeasures: string[];
  }>;
  currentConcerns: Array<{
    symptom: string;
    possibleCause: string;
    discussWithProvider: string;
    discussionTiming: "discuss_soon" | "at_next_visit" | "monitor";
  }>;
  educationalAlerts: Array<{
    topic: string;
    reason: string;
    discussionPoint: string;
  }>;
  aiConfidence: number;
  disclaimer: string;
}

interface AIInsightsResponse {
  carePlan: AISurvivorshipCarePlan;
  followUpSummary: AIFollowUpSummary;
  lateEffectAnalysis: AILateEffectAnalysis;
  disclaimer: string;
}

interface WellnessEntry {
  id: string;
  profileId: string;
  date: string;
  physicalScore: number;
  emotionalScore: number;
  socialScore: number;
  sleepQuality: number;
  energyLevel: number;
  painLevel: number;
  anxietyLevel: number;
  notes?: string;
  createdAt: string;
}

interface WellnessTrend {
  current: number;
  previous: number;
  trend: "improving" | "stable" | "declining";
}

interface QoLAssessment {
  id: string;
  profileId: string;
  date: string;
  overallScore: number;
  domains: {
    physical: number;
    emotional: number;
    social: number;
    functional: number;
    cognitive: number;
    spiritual: number;
  };
  interpretations: string[];
  createdAt: string;
}

interface WellnessRecommendation {
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  resources: string[];
}

function WellnessTracking({ profileId }: { profileId?: string }) {
  const [showAddWellnessDialog, setShowAddWellnessDialog] = useState(false);
  const [showQoLDialog, setShowQoLDialog] = useState(false);
  const { toast } = useToast();

  const { data: wellnessData, isLoading: loadingWellness } = useQuery<{
    entries: WellnessEntry[];
    trends: { physical: WellnessTrend; emotional: WellnessTrend; energy: WellnessTrend } | null;
  }>({
    queryKey: ["/api/survivorship/wellness", profileId],
  });

  const { data: qolAssessments } = useQuery<QoLAssessment[]>({
    queryKey: ["/api/survivorship/qol", profileId],
  });

  const { data: recommendations, mutate: fetchRecommendations, isPending: loadingRecs } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/survivorship/ai-wellness-recommendations", { profileId });
      return response.json() as Promise<{ recommendations: WellnessRecommendation[]; disclaimer: string }>;
    },
  });

  const addWellnessMutation = useMutation({
    mutationFn: async (data: Partial<WellnessEntry>) => {
      const response = await apiRequest("POST", "/api/survivorship/wellness", { ...data, profileId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/wellness", profileId] });
      setShowAddWellnessDialog(false);
      toast({ title: "Entry saved", description: "Your wellness check-in has been recorded." });
    },
  });

  const addQoLMutation = useMutation({
    mutationFn: async (domains: QoLAssessment["domains"]) => {
      const response = await apiRequest("POST", "/api/survivorship/qol", { profileId, domains });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/qol", profileId] });
      setShowQoLDialog(false);
      toast({ title: "Assessment saved", description: "Your quality of life assessment has been recorded." });
    },
  });

  const getTrendIcon = (trend?: "improving" | "stable" | "declining") => {
    if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "declining") return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const priorityColors = {
    high: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
    low: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  };

  if (loadingWellness) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> Wellness tracking is for personal awareness only.
          Always consult your healthcare provider for medical guidance and treatment decisions.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Wellness Tracking</h2>
          <p className="text-muted-foreground">
            Track your physical and emotional well-being during survivorship
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddWellnessDialog(true)} data-testid="button-add-wellness">
            <Plus className="h-4 w-4 mr-2" />
            Daily Check-in
          </Button>
          <Button variant="outline" onClick={() => setShowQoLDialog(true)} data-testid="button-qol-assessment">
            <Target className="h-4 w-4 mr-2" />
            QoL Assessment
          </Button>
        </div>
      </div>

      {wellnessData?.trends && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Physical Well-being</p>
                  <p className="text-2xl font-bold">{wellnessData.trends.physical.current.toFixed(1)}/10</p>
                </div>
                {getTrendIcon(wellnessData.trends.physical.trend)}
              </div>
              <Progress value={wellnessData.trends.physical.current * 10} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emotional Well-being</p>
                  <p className="text-2xl font-bold">{wellnessData.trends.emotional.current.toFixed(1)}/10</p>
                </div>
                {getTrendIcon(wellnessData.trends.emotional.trend)}
              </div>
              <Progress value={wellnessData.trends.emotional.current * 10} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Energy Level</p>
                  <p className="text-2xl font-bold">{wellnessData.trends.energy.current.toFixed(1)}/10</p>
                </div>
                {getTrendIcon(wellnessData.trends.energy.trend)}
              </div>
              <Progress value={wellnessData.trends.energy.current * 10} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {qolAssessments && qolAssessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Latest Quality of Life Assessment
            </CardTitle>
            <CardDescription>
              Completed on {new Date(qolAssessments[0].date).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {Object.entries(qolAssessments[0].domains).map(([domain, score]) => (
                <div key={domain} className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground capitalize">{domain}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{score}</span>
                    <Progress value={score} className="h-2 flex-1" />
                  </div>
                </div>
              ))}
            </div>
            {qolAssessments[0].interpretations.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm mb-2">Insights</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {qolAssessments[0].interpretations.map((interp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500" />
                      {interp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Wellness Recommendations
          </CardTitle>
          <CardDescription>
            Personalized suggestions based on your wellness data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recommendations && (
            <Button
              onClick={() => fetchRecommendations()}
              disabled={loadingRecs}
              className="w-full"
              data-testid="button-get-recommendations"
            >
              {loadingRecs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Personalized Recommendations
                </>
              )}
            </Button>
          )}
          {recommendations && (
            <div className="space-y-4">
              <Alert className="border-blue-500/30 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                  {recommendations.disclaimer}
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                {recommendations.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Badge className={priorityColors[rec.priority]} variant="outline">
                        {rec.priority}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                        {rec.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.resources.map((resource, ridx) => (
                              <Badge key={ridx} variant="secondary" className="text-xs">
                                {resource}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {wellnessData?.entries && wellnessData.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wellnessData.entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="text-center">
                    <p className="text-sm font-medium">{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Physical</p>
                      <p className="font-medium">{entry.physicalScore}/10</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Emotional</p>
                      <p className="font-medium">{entry.emotionalScore}/10</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Energy</p>
                      <p className="font-medium">{entry.energyLevel}/10</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep</p>
                      <p className="font-medium">{entry.sleepQuality}/10</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddWellnessDialog
        open={showAddWellnessDialog}
        onOpenChange={setShowAddWellnessDialog}
        onSubmit={(data) => addWellnessMutation.mutate(data)}
        isPending={addWellnessMutation.isPending}
      />

      <QoLAssessmentDialog
        open={showQoLDialog}
        onOpenChange={setShowQoLDialog}
        onSubmit={(domains) => addQoLMutation.mutate(domains)}
        isPending={addQoLMutation.isPending}
      />
    </div>
  );
}

function AddWellnessDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<WellnessEntry>) => void;
  isPending: boolean;
}) {
  const [physicalScore, setPhysicalScore] = useState(7);
  const [emotionalScore, setEmotionalScore] = useState(7);
  const [socialScore, setSocialScore] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(7);
  const [energyLevel, setEnergyLevel] = useState(7);
  const [painLevel, setPainLevel] = useState(2);
  const [anxietyLevel, setAnxietyLevel] = useState(3);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Wellness Check-in</DialogTitle>
          <DialogDescription>
            Rate each area from 1 (poor) to 10 (excellent)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Physical Well-being</Label>
              <span className="font-medium">{physicalScore}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={physicalScore}
              onChange={(e) => setPhysicalScore(Number(e.target.value))}
              className="w-full"
              data-testid="slider-physical"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Emotional Well-being</Label>
              <span className="font-medium">{emotionalScore}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={emotionalScore}
              onChange={(e) => setEmotionalScore(Number(e.target.value))}
              className="w-full"
              data-testid="slider-emotional"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Social Connection</Label>
              <span className="font-medium">{socialScore}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={socialScore}
              onChange={(e) => setSocialScore(Number(e.target.value))}
              className="w-full"
              data-testid="slider-social"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Sleep Quality</Label>
              <span className="font-medium">{sleepQuality}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={sleepQuality}
              onChange={(e) => setSleepQuality(Number(e.target.value))}
              className="w-full"
              data-testid="slider-sleep"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Energy Level</Label>
              <span className="font-medium">{energyLevel}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={energyLevel}
              onChange={(e) => setEnergyLevel(Number(e.target.value))}
              className="w-full"
              data-testid="slider-energy"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Pain Level (1=none, 10=severe)</Label>
              <span className="font-medium">{painLevel}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={painLevel}
              onChange={(e) => setPainLevel(Number(e.target.value))}
              className="w-full"
              data-testid="slider-pain"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Anxiety Level (1=none, 10=severe)</Label>
              <span className="font-medium">{anxietyLevel}</span>
            </div>
            <Input
              type="range"
              min="1"
              max="10"
              value={anxietyLevel}
              onChange={(e) => setAnxietyLevel(Number(e.target.value))}
              className="w-full"
              data-testid="slider-anxiety"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling today?"
              rows={2}
              data-testid="textarea-wellness-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit({
              physicalScore,
              emotionalScore,
              socialScore,
              sleepQuality,
              energyLevel,
              painLevel,
              anxietyLevel,
              notes: notes || undefined,
            })}
            disabled={isPending}
            data-testid="button-save-wellness"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QoLAssessmentDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (domains: QoLAssessment["domains"]) => void;
  isPending: boolean;
}) {
  const [physical, setPhysical] = useState(70);
  const [emotional, setEmotional] = useState(70);
  const [social, setSocial] = useState(70);
  const [functional, setFunctional] = useState(70);
  const [cognitive, setCognitive] = useState(70);
  const [spiritual, setSpiritual] = useState(70);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quality of Life Assessment</DialogTitle>
          <DialogDescription>
            Rate each domain from 0 (poor) to 100 (excellent)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Physical Function</Label>
              <span className="font-medium">{physical}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={physical}
              onChange={(e) => setPhysical(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-physical"
            />
            <p className="text-xs text-muted-foreground">Ability to perform daily activities</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Emotional Well-being</Label>
              <span className="font-medium">{emotional}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={emotional}
              onChange={(e) => setEmotional(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-emotional"
            />
            <p className="text-xs text-muted-foreground">Mood, anxiety, and emotional health</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Social Function</Label>
              <span className="font-medium">{social}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={social}
              onChange={(e) => setSocial(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-social"
            />
            <p className="text-xs text-muted-foreground">Relationships and social activities</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Functional Well-being</Label>
              <span className="font-medium">{functional}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={functional}
              onChange={(e) => setFunctional(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-functional"
            />
            <p className="text-xs text-muted-foreground">Work, hobbies, and daily routines</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Cognitive Function</Label>
              <span className="font-medium">{cognitive}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={cognitive}
              onChange={(e) => setCognitive(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-cognitive"
            />
            <p className="text-xs text-muted-foreground">Memory, concentration, and thinking</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Spiritual Well-being</Label>
              <span className="font-medium">{spiritual}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={spiritual}
              onChange={(e) => setSpiritual(Number(e.target.value))}
              className="w-full"
              data-testid="slider-qol-spiritual"
            />
            <p className="text-xs text-muted-foreground">Meaning, purpose, and inner peace</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit({ physical, emotional, social, functional, cognitive, spiritual })}
            disabled={isPending}
            data-testid="button-save-qol"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AISurvivorshipInsights({ profileId }: { profileId?: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateInsights = async () => {
    if (!profileId) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", `/api/survivorship/${profileId}/ai-insights`, {
        reportedSymptoms: [],
      });
      const data = await response.json() as AIInsightsResponse;
      setInsights(data);
      toast({
        title: "AI Insights Generated",
        description: "Your personalized survivorship care insights are ready.",
      });
    } catch (err) {
      setError("Failed to generate AI insights. Please try again.");
      console.error("[AI Insights] Error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const priorityColors = {
    high: "bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30",
    medium: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    low: "bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30",
  };

  const urgencyColors = {
    immediate: "bg-red-500/20 text-red-700 dark:text-red-300",
    soon: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    routine: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    monitor: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
  };

  const riskColors = {
    high: "bg-red-500/20 text-red-700 dark:text-red-300",
    moderate: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    low: "bg-green-500/20 text-green-700 dark:text-green-300",
  };

  if (!profileId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Please create a survivorship profile first to access AI insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-blue-500/30 bg-blue-500/10">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Educational Information Only:</strong> These AI-generated insights are for educational purposes only and do NOT constitute medical advice. 
          Always consult your healthcare provider for personalized medical guidance and clinical decisions.
        </AlertDescription>
      </Alert>

      {!insights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Survivorship Insights
            </CardTitle>
            <CardDescription>
              Generate personalized educational content about your survivorship care based on your treatment history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-medium">Care Plan Overview</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Educational overview of survivorship care recommendations
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="font-medium">Follow-up Summary</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  AI summary of your follow-up care needs and screening schedule
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <span className="font-medium">Late Effect Analysis</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Proactive identification of potential late effects to discuss with your doctor
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={generateInsights}
              disabled={isGenerating}
              className="w-full min-h-[44px]"
              data-testid="button-generate-insights"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating AI Insights...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Survivorship Insights
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {insights && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Your AI Insights</h2>
            <Button
              variant="outline"
              onClick={generateInsights}
              disabled={isGenerating}
              className="min-h-[44px]"
              data-testid="button-regenerate-insights"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Regenerate
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Survivorship Care Plan Overview
              </CardTitle>
              <CardDescription>
                AI Confidence: {Math.round(insights.carePlan.aiConfidence * 100)}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm">{insights.carePlan.overviewSummary}</p>
              </div>

              {insights.carePlan.immediateFollowUpNeeds.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Suggested Follow-up Areas
                  </h4>
                  <div className="space-y-2">
                    {insights.carePlan.immediateFollowUpNeeds.map((need, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Badge className={priorityColors[need.priority]} variant="outline">
                          {need.priority}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{need.title}</p>
                          <p className="text-sm text-muted-foreground">{need.rationale}</p>
                          <p className="text-xs text-muted-foreground mt-1">Frequency: {need.frequency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.carePlan.lifestyleRecommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Lifestyle Considerations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insights.carePlan.lifestyleRecommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 rounded-lg border bg-card">
                        <Badge variant="secondary" className="mb-2">{rec.category}</Badge>
                        <p className="text-sm font-medium">{rec.recommendation}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rec.benefit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.carePlan.mentalHealthSupport.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Mental Health & Support
                  </h4>
                  <div className="space-y-2">
                    {insights.carePlan.mentalHealthSupport.map((support, idx) => (
                      <div key={idx} className="p-3 rounded-lg border">
                        <p className="font-medium">{support.concern}</p>
                        <p className="text-sm text-muted-foreground">{support.recommendation}</p>
                        {support.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {support.resources.map((resource, ridx) => (
                              <Badge key={ridx} variant="outline" className="text-xs">
                                {resource}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Follow-up Care Summary
              </CardTitle>
              <CardDescription>
                AI Confidence: {Math.round(insights.followUpSummary.aiConfidence * 100)}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Overdue Items</h4>
                  <p className="text-sm">{insights.followUpSummary.overdueSummary}</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Upcoming</h4>
                  <p className="text-sm">{insights.followUpSummary.upcomingSummary}</p>
                </div>
              </div>

              {insights.followUpSummary.discussionPoints.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Topics to Discuss with Your Provider</h4>
                  <div className="space-y-2">
                    {insights.followUpSummary.discussionPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Badge className={point.timeframe === "discuss_soon" ? urgencyColors.immediate : point.timeframe === "upcoming" ? urgencyColors.soon : urgencyColors.routine}>
                          {point.timeframe === "discuss_soon" ? "discuss soon" : point.timeframe}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{point.topic}</p>
                          <p className="text-sm text-muted-foreground">{point.reason}</p>
                          {point.suggestedDate && (
                            <p className="text-xs text-muted-foreground mt-1">Suggested: {point.suggestedDate}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.followUpSummary.screeningRecommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Screening Information</h4>
                  <div className="space-y-2">
                    {insights.followUpSummary.screeningRecommendations.map((screening, idx) => (
                      <div key={idx} className="p-3 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <p className="font-medium">{screening.screening}</p>
                          <Badge variant="outline">{screening.frequency}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{screening.importance}</p>
                        <p className="text-xs text-muted-foreground">Next suggested: {screening.nextDue}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Adherence Insights</h4>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-2xl font-bold">{insights.followUpSummary.adherenceInsights.completionRate}%</span>
                    <p className="text-xs text-muted-foreground">Completion Rate</p>
                  </div>
                  <div className="flex-1">
                    <Progress value={insights.followUpSummary.adherenceInsights.completionRate} className="h-2" />
                  </div>
                  <Badge variant="secondary">{insights.followUpSummary.adherenceInsights.trend}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{insights.followUpSummary.adherenceInsights.suggestion}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Late Effect Analysis
              </CardTitle>
              <CardDescription>
                AI Confidence: {Math.round(insights.lateEffectAnalysis.aiConfidence * 100)}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {insights.lateEffectAnalysis.educationalAlerts && insights.lateEffectAnalysis.educationalAlerts.length > 0 && (
                <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Topics to Discuss with Your Healthcare Provider:</strong>
                    <ul className="mt-2 space-y-1">
                      {insights.lateEffectAnalysis.educationalAlerts.map((alert, idx) => (
                        <li key={idx}>
                          <strong>{alert.topic}</strong>: {alert.reason}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {insights.lateEffectAnalysis.potentialLateEffects.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Potential Late Effects to Discuss</h4>
                  <div className="space-y-4">
                    {insights.lateEffectAnalysis.potentialLateEffects.map((effect, idx) => (
                      <div key={idx} className="p-4 rounded-lg border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h5 className="font-medium">{effect.effectType}</h5>
                          <Badge className={riskColors[effect.riskLevel]}>
                            {effect.riskLevel} risk
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Related to: {effect.relatedTreatments.join(", ")}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Typical onset: {effect.typicalOnsetTime}
                        </p>
                        
                        {effect.symptoms.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Symptoms to be aware of:</p>
                            <div className="flex flex-wrap gap-1">
                              {effect.symptoms.map((symptom, sidx) => (
                                <Badge key={sidx} variant="outline" className="text-xs">
                                  {symptom}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {effect.discussionTopics.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Discussion topics for your provider:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {effect.discussionTopics.map((topic, tidx) => (
                                <li key={tidx}>{topic}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.lateEffectAnalysis.currentConcerns.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Topics to Discuss</h4>
                  <div className="space-y-2">
                    {insights.lateEffectAnalysis.currentConcerns.map((concern, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Badge className={concern.discussionTiming === "discuss_soon" ? urgencyColors.immediate : concern.discussionTiming === "at_next_visit" ? urgencyColors.soon : urgencyColors.routine}>
                          {concern.discussionTiming === "discuss_soon" ? "discuss soon" : concern.discussionTiming === "at_next_visit" ? "next visit" : "monitor"}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{concern.symptom}</p>
                          <p className="text-sm text-muted-foreground">{concern.possibleCause}</p>
                          <p className="text-sm mt-1"><strong>Discussion point:</strong> {concern.discussWithProvider}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.lateEffectAnalysis.potentialLateEffects.length === 0 && 
               insights.lateEffectAnalysis.currentConcerns.length === 0 && (
                <div className="text-center py-6">
                  <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    No specific late effect concerns identified at this time.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Alert className="border-blue-500/30 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Reminder:</strong> {insights.disclaimer}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

// ==================== DAILY WELLNESS METRICS (7 METRICS) ====================

interface DailyWellnessEntry {
  id: string;
  profileId: string;
  date: string;
  sleep: number;
  fatigue: number;
  pain: number;
  mood: number;
  appetite: number;
  exercise: number;
  hydration: number;
  notes?: string;
}

interface DailyWellnessTrend {
  current: number;
  previous: number;
  trend: "improving" | "worsening" | "stable";
  change: number;
}

function DailyWellnessMetrics({ profileId }: { profileId?: string }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const { data: wellnessData, isLoading } = useQuery<{
    entries: DailyWellnessEntry[];
    trends: Record<string, DailyWellnessTrend> | null;
    weeklyAverages: Array<{ weekStart: string; sleep: number; fatigue: number; pain: number; mood: number; appetite: number; exercise: number; hydration: number }>;
    disclaimer: string;
  }>({
    queryKey: ["/api/survivorship/daily-wellness", profileId],
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/survivorship/ai-wellness-analysis", { profileId });
      return response.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<DailyWellnessEntry>) => {
      const response = await apiRequest("POST", "/api/survivorship/daily-wellness", { ...data, profileId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/daily-wellness", profileId] });
      setShowAddDialog(false);
      toast({ title: "Saved", description: "Daily wellness entry recorded." });
    },
  });

  const getTrendIcon = (metric: string, trend?: DailyWellnessTrend) => {
    if (!trend) return null;
    const isInverse = metric === "fatigue" || metric === "pain";
    const improving = isInverse ? trend.trend === "improving" : trend.trend === "improving";
    const worsening = isInverse ? trend.trend === "worsening" : trend.trend === "worsening";
    
    if (improving) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (worsening) return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const getMetricColor = (metric: string, value: number) => {
    const isInverse = metric === "fatigue" || metric === "pain";
    if (isInverse) {
      if (value <= 3) return "text-green-600";
      if (value <= 6) return "text-amber-600";
      return "text-red-600";
    } else {
      if (value >= 7) return "text-green-600";
      if (value >= 4) return "text-amber-600";
      return "text-red-600";
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> Track your daily wellness for personal awareness. Always consult your healthcare provider.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Daily Wellness Metrics</h2>
          <p className="text-muted-foreground">Track 7 key metrics daily: sleep, fatigue, pain, mood, appetite, exercise, hydration</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-daily-wellness">
            <Plus className="h-4 w-4 mr-2" />
            Log Today
          </Button>
          <Button 
            variant="outline" 
            onClick={() => analysisMutation.mutate()} 
            disabled={analysisMutation.isPending}
            data-testid="button-ai-wellness-analysis"
          >
            {analysisMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            AI Analysis
          </Button>
        </div>
      </div>

      {wellnessData?.trends && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(["sleep", "fatigue", "pain", "mood", "appetite", "exercise", "hydration"] as const).map((metric) => (
            <Card key={metric}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground capitalize">{metric}</span>
                  {getTrendIcon(metric, wellnessData.trends?.[metric])}
                </div>
                <p className={`text-xl font-bold ${getMetricColor(metric, wellnessData.trends?.[metric]?.current || 5)}`}>
                  {wellnessData.trends?.[metric]?.current.toFixed(1) || "—"}/10
                </p>
                {wellnessData.trends?.[metric] && (
                  <p className={`text-xs ${wellnessData.trends[metric].change > 0 ? (metric === "fatigue" || metric === "pain" ? "text-red-600" : "text-green-600") : wellnessData.trends[metric].change < 0 ? (metric === "fatigue" || metric === "pain" ? "text-green-600" : "text-red-600") : "text-muted-foreground"}`}>
                    {wellnessData.trends[metric].change > 0 ? "+" : ""}{wellnessData.trends[metric].change.toFixed(1)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analysisMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Wellness Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/30 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                {analysisMutation.data.disclaimer}
              </AlertDescription>
            </Alert>
            {analysisMutation.data.analysis && (
              <>
                <p className="text-sm">{analysisMutation.data.analysis.summary}</p>
                {analysisMutation.data.analysis.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Suggestions</h4>
                    <ul className="space-y-1">
                      {analysisMutation.data.analysis.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisMutation.data.analysis.concerns?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-amber-600">Areas to Discuss</h4>
                    <ul className="space-y-1">
                      {analysisMutation.data.analysis.concerns.map((concern: string, idx: number) => (
                        <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {wellnessData?.entries && wellnessData.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {wellnessData.entries.slice(0, 7).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-medium">{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="flex-1 grid grid-cols-7 gap-2 text-xs">
                    <div title="Sleep"><span className="block text-muted-foreground">Sleep</span><span className={`font-medium ${getMetricColor("sleep", entry.sleep)}`}>{entry.sleep}</span></div>
                    <div title="Fatigue"><span className="block text-muted-foreground">Fatigue</span><span className={`font-medium ${getMetricColor("fatigue", entry.fatigue)}`}>{entry.fatigue}</span></div>
                    <div title="Pain"><span className="block text-muted-foreground">Pain</span><span className={`font-medium ${getMetricColor("pain", entry.pain)}`}>{entry.pain}</span></div>
                    <div title="Mood"><span className="block text-muted-foreground">Mood</span><span className={`font-medium ${getMetricColor("mood", entry.mood)}`}>{entry.mood}</span></div>
                    <div title="Appetite"><span className="block text-muted-foreground">Appetite</span><span className={`font-medium ${getMetricColor("appetite", entry.appetite)}`}>{entry.appetite}</span></div>
                    <div title="Exercise"><span className="block text-muted-foreground">Exercise</span><span className={`font-medium ${getMetricColor("exercise", entry.exercise)}`}>{entry.exercise}</span></div>
                    <div title="Hydration"><span className="block text-muted-foreground">Hydration</span><span className={`font-medium ${getMetricColor("hydration", entry.hydration)}`}>{entry.hydration}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddDailyWellnessDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={(data) => addMutation.mutate(data)}
        isPending={addMutation.isPending}
      />
    </div>
  );
}

function AddDailyWellnessDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<DailyWellnessEntry>) => void;
  isPending: boolean;
}) {
  const [sleep, setSleep] = useState(7);
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(2);
  const [mood, setMood] = useState(7);
  const [appetite, setAppetite] = useState(7);
  const [exercise, setExercise] = useState(5);
  const [hydration, setHydration] = useState(7);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Wellness Check-in</DialogTitle>
          <DialogDescription>Rate each metric (0-10). For fatigue/pain, lower is better.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {[
            { label: "Sleep Quality", value: sleep, setValue: setSleep, hint: "0=poor, 10=excellent" },
            { label: "Fatigue Level", value: fatigue, setValue: setFatigue, hint: "0=none, 10=severe" },
            { label: "Pain Level", value: pain, setValue: setPain, hint: "0=none, 10=severe" },
            { label: "Mood", value: mood, setValue: setMood, hint: "0=very low, 10=excellent" },
            { label: "Appetite", value: appetite, setValue: setAppetite, hint: "0=no appetite, 10=great" },
            { label: "Exercise/Activity", value: exercise, setValue: setExercise, hint: "0=none, 10=very active" },
            { label: "Hydration", value: hydration, setValue: setHydration, hint: "0=poor, 10=excellent" },
          ].map(({ label, value, setValue, hint }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <Label>{label}</Label>
                <span className="font-medium">{value}</span>
              </div>
              <Input type="range" min="0" max="10" value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full" />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How are you feeling today?" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit({ sleep, fatigue, pain, mood, appetite, exercise, hydration, notes: notes || undefined })} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SYMPTOM JOURNAL ====================

interface SymptomJournalEntry {
  id: string;
  profileId: string;
  date: string;
  time?: string;
  symptomType: string;
  severity: number;
  duration: string;
  triggers: string[];
  reliefMethods: string[];
  reliefEffectiveness?: number;
  location?: string;
  affectedDailyActivities: boolean;
  notes?: string;
}

interface SymptomPattern {
  symptomType: string;
  frequency: number;
  averageSeverity: number;
  commonTriggers: string[];
  effectiveReliefMethods: string[];
  trend: "improving" | "worsening" | "stable";
}

function SymptomJournal({ profileId }: { profileId?: string }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const { data: journalData, isLoading } = useQuery<{
    entries: SymptomJournalEntry[];
    totalCount: number;
    disclaimer: string;
  }>({
    queryKey: ["/api/survivorship/symptom-journal", profileId],
  });

  const patternsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/survivorship/symptom-patterns", { profileId });
      return response.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<SymptomJournalEntry>) => {
      const response = await apiRequest("POST", "/api/survivorship/symptom-journal", { ...data, profileId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survivorship/symptom-journal", profileId] });
      setShowAddDialog(false);
      toast({ title: "Saved", description: "Symptom entry recorded." });
    },
  });

  const getSeverityColor = (severity: number) => {
    if (severity <= 3) return "bg-green-500/20 text-green-700 dark:text-green-300";
    if (severity <= 6) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
    return "bg-red-500/20 text-red-700 dark:text-red-300";
  };

  const getTrendBadge = (trend: string) => {
    if (trend === "improving") return <Badge className="bg-green-500/20 text-green-700 dark:text-green-300">Improving</Badge>;
    if (trend === "worsening") return <Badge className="bg-red-500/20 text-red-700 dark:text-red-300">Worsening</Badge>;
    return <Badge variant="secondary">Stable</Badge>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> Track symptoms for personal awareness. Report concerning symptoms to your healthcare provider.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Symptom Journal</h2>
          <p className="text-muted-foreground">Track symptoms, triggers, and what helps with AI pattern analysis</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-symptom">
            <Plus className="h-4 w-4 mr-2" />
            Log Symptom
          </Button>
          <Button 
            variant="outline" 
            onClick={() => patternsMutation.mutate()} 
            disabled={patternsMutation.isPending || (journalData?.entries?.length || 0) < 3}
            data-testid="button-symptom-patterns"
          >
            {patternsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analyze Patterns
          </Button>
        </div>
      </div>

      {patternsMutation.data && patternsMutation.data.patterns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Symptom Patterns
            </CardTitle>
            <CardDescription>Based on {patternsMutation.data.entriesAnalyzed} logged symptoms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/30 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                {patternsMutation.data.disclaimer}
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patternsMutation.data.patterns.map((pattern: SymptomPattern) => (
                <Card key={pattern.symptomType} className="border">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium capitalize">{pattern.symptomType.replace(/_/g, " ")}</h4>
                      {getTrendBadge(pattern.trend)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Occurrences:</span>
                        <span className="font-medium ml-1">{pattern.frequency}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Severity:</span>
                        <span className="font-medium ml-1">{pattern.averageSeverity}/10</span>
                      </div>
                    </div>
                    {pattern.commonTriggers.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Common Triggers:</p>
                        <div className="flex flex-wrap gap-1">
                          {pattern.commonTriggers.map((t, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {pattern.effectiveReliefMethods.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Effective Relief:</p>
                        <div className="flex flex-wrap gap-1">
                          {pattern.effectiveReliefMethods.map((r, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {patternsMutation.data.insights?.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm mb-2">AI Insights</h4>
                <ul className="space-y-2">
                  {patternsMutation.data.insights.map((insight: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {journalData?.entries && journalData.entries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent Symptoms</CardTitle>
            <CardDescription>{journalData.totalCount} total entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {journalData.entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-medium capitalize">{entry.symptomType.replace(/_/g, " ")}</span>
                      {entry.location && <span className="text-sm text-muted-foreground ml-2">({entry.location})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(entry.severity)}>{entry.severity}/10</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <span>Duration: {entry.duration}</span>
                    {entry.affectedDailyActivities && <Badge variant="outline" className="ml-2 text-xs">Affected activities</Badge>}
                  </div>
                  {entry.triggers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">Triggers:</span>
                      {entry.triggers.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                  )}
                  {entry.reliefMethods.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Relief:</span>
                      {entry.reliefMethods.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)}
                      {entry.reliefEffectiveness && <span className="text-xs text-muted-foreground ml-1">(Effectiveness: {entry.reliefEffectiveness}/10)</span>}
                    </div>
                  )}
                  {entry.notes && <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Symptoms Logged</h3>
            <p className="text-muted-foreground mb-4">Start tracking symptoms to identify patterns</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log First Symptom
            </Button>
          </CardContent>
        </Card>
      )}

      <AddSymptomDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={(data) => addMutation.mutate(data)}
        isPending={addMutation.isPending}
      />
    </div>
  );
}

function AddSymptomDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<SymptomJournalEntry>) => void;
  isPending: boolean;
}) {
  const [symptomType, setSymptomType] = useState("fatigue");
  const [severity, setSeverity] = useState(5);
  const [duration, setDuration] = useState("1-2 hours");
  const [location, setLocation] = useState("");
  const [triggers, setTriggers] = useState("");
  const [reliefMethods, setReliefMethods] = useState("");
  const [reliefEffectiveness, setReliefEffectiveness] = useState(5);
  const [affectedDailyActivities, setAffectedDailyActivities] = useState(false);
  const [notes, setNotes] = useState("");

  const symptomTypes = ["fatigue", "neuropathy", "pain", "joint_pain", "cognitive_changes", "nausea", "sleep_issues", "anxiety", "depression", "hot_flashes", "lymphedema", "other"];
  const durations = ["less than 1 hour", "1-2 hours", "2-4 hours", "4-6 hours", "several hours", "all day", "ongoing"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Symptom</DialogTitle>
          <DialogDescription>Track symptoms to identify patterns over time</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Symptom Type</Label>
            <Select value={symptomType} onValueChange={setSymptomType}>
              <SelectTrigger data-testid="select-symptom-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {symptomTypes.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <Label>Severity</Label>
              <span className="font-medium">{severity}/10</span>
            </div>
            <Input type="range" min="1" max="10" value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {durations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., fingertips, knees, head" />
          </div>
          <div className="space-y-2">
            <Label>Triggers (comma-separated)</Label>
            <Input value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder="e.g., stress, cold weather, exercise" />
          </div>
          <div className="space-y-2">
            <Label>Relief Methods (comma-separated)</Label>
            <Input value={reliefMethods} onChange={(e) => setReliefMethods(e.target.value)} placeholder="e.g., rest, medication, heat" />
          </div>
          {reliefMethods && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <Label>Relief Effectiveness</Label>
                <span className="font-medium">{reliefEffectiveness}/10</span>
              </div>
              <Input type="range" min="0" max="10" value={reliefEffectiveness} onChange={(e) => setReliefEffectiveness(Number(e.target.value))} className="w-full" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="affected" checked={affectedDailyActivities} onChange={(e) => setAffectedDailyActivities(e.target.checked)} />
            <Label htmlFor="affected" className="text-sm">Affected daily activities</Label>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional details..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => onSubmit({ 
              symptomType, 
              severity, 
              duration, 
              location: location || undefined,
              triggers: triggers ? triggers.split(",").map(t => t.trim()) : [],
              reliefMethods: reliefMethods ? reliefMethods.split(",").map(r => r.trim()) : [],
              reliefEffectiveness: reliefMethods ? reliefEffectiveness : undefined,
              affectedDailyActivities,
              notes: notes || undefined,
            })} 
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
