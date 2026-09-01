import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Minus, Target, Lightbulb, Heart, Award,
  Clock, Flag, AlertTriangle, CheckCircle, MessageSquare, RefreshCw,
  Activity, Brain, Smile, Pill, Footprints, Moon, ArrowUpRight, ArrowDownRight,
  Sparkles, Star, ChevronRight
} from "lucide-react";

interface DataTrend {
  dataType: "symptom" | "mood" | "vital" | "adherence" | "activity" | "sleep" | "nutrition";
  metricName: string;
  currentValue: number | string;
  previousValue: number | string;
  unit: string;
  direction: "shows upward" | "shows stable" | "shows downward";
  percentChange: number;
  timeframe: string;
  significance: "significant" | "moderate" | "minor";
  analysis: string;
}

interface PatternInsight {
  id: string;
  patternType: "connection" | "cycle" | "trigger" | "progress" | "awareness";
  title: string;
  description: string;
  relatedMetrics: string[];
  confidence: "high" | "medium" | "low";
  timespan: string;
  implications: string;
}

interface GoalProgressFeedback {
  goalId: string;
  goalTitle: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPercent: number;
  trajectory: "on_track" | "ahead" | "behind" | "at_risk";
  estimatedCompletion: string;
  recentTrend: "shows faster" | "shows steady" | "shows slower" | "shows paused";
  feedbackMessage: string;
  celebrationMilestone?: string;
}

interface EncouragementMessage {
  id: string;
  type: "celebration" | "motivation" | "recognition" | "support" | "milestone";
  title: string;
  message: string;
  basedOn: string;
  intensity: "subtle" | "moderate" | "enthusiastic";
  actionPrompt?: string;
}

interface MotivationalTip {
  id: string;
  category: "mindset" | "routine" | "strategy" | "recovery" | "momentum";
  tip: string;
  rationale: string;
  applicability: string;
  source?: string;
}

interface SuggestedAdjustment {
  id: string;
  type: "goal_adjustment" | "timing_change" | "method_modification" | "frequency_update" | "target_revision";
  title: string;
  currentState: string;
  suggestedChange: string;
  rationale: string;
  expectedImpact: string;
  priority: "high" | "medium" | "low";
  requiresClinicianReview: boolean;
  clinicianReviewReason?: string;
}

interface ClinicianFlag {
  id: string;
  severity: "low" | "medium" | "high" | "urgent";
  category: "non_adherence" | "adverse_trend" | "goal_revision" | "intervention_needed" | "patient_request";
  title: string;
  description: string;
  relatedData: { dataType: string; metric: string; values: string; trend: string; }[];
  suggestedAction: string;
  patientContext: string;
  flaggedAt: string;
  status: "pending" | "reviewed" | "addressed" | "dismissed";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

interface ProgressFeedback {
  patientId: string;
  generatedAt: string;
  dataTrends: DataTrend[];
  patternInsights: PatternInsight[];
  goalProgressFeedback: GoalProgressFeedback[];
  encouragementMessages: EncouragementMessage[];
  motivationalTips: MotivationalTip[];
  suggestedAdjustments: SuggestedAdjustment[];
  clinicianFlags: ClinicianFlag[];
  overallProgressSummary: string;
  strengthsIdentified: string[];
  areasForFocus: string[];
  nextMilestones: string[];
}

const dataTypeIcons: Record<string, React.ElementType> = {
  symptom: Activity,
  mood: Smile,
  vital: Heart,
  adherence: Pill,
  activity: Footprints,
  sleep: Moon,
  nutrition: Target
};

const dataTypeLabels: Record<string, string> = {
  symptom: "Symptom",
  mood: "Mood",
  vital: "Vital Sign",
  adherence: "Adherence",
  activity: "Activity",
  sleep: "Sleep",
  nutrition: "Nutrition"
};

function TrendIcon({ direction }: { direction: "shows upward" | "shows stable" | "shows downward" }) {
  if (direction === "shows upward") {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  } else if (direction === "shows downward") {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function TrajectoryBadge({ trajectory }: { trajectory: GoalProgressFeedback["trajectory"] }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    on_track: "default",
    ahead: "default",
    behind: "secondary",
    at_risk: "destructive"
  };
  const labels: Record<string, string> = {
    on_track: "On Track",
    ahead: "Ahead!",
    behind: "Behind",
    at_risk: "At Risk"
  };
  return <Badge variant={variants[trajectory]}>{labels[trajectory]}</Badge>;
}

function EncouragementIcon({ type }: { type: EncouragementMessage["type"] }) {
  const icons: Record<string, React.ElementType> = {
    celebration: Star,
    motivation: Sparkles,
    recognition: Award,
    support: Heart,
    milestone: Target
  };
  const Icon = icons[type] || Sparkles;
  return <Icon className="w-5 h-5" />;
}

export default function ProgressFeedbackPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<SuggestedAdjustment | null>(null);
  const [flagNotes, setFlagNotes] = useState("");
  const patientId = "patient-1";

  const { data: feedback, isLoading, refetch } = useQuery<ProgressFeedback>({
    queryKey: ["/api/progress-feedback", patientId],
  });

  const createFlagMutation = useMutation({
    mutationFn: async (adjustment: SuggestedAdjustment) => {
      return apiRequest("POST", `/api/progress-feedback/${patientId}/clinician-flags`, {
        severity: adjustment.priority === "high" ? "medium" : "low",
        category: "goal_revision",
        title: adjustment.title,
        description: adjustment.suggestedChange,
        relatedData: [{
          dataType: "adjustment",
          metric: adjustment.type,
          values: adjustment.currentState,
          trend: adjustment.expectedImpact
        }],
        suggestedAction: adjustment.clinicianReviewReason || "Review suggested adjustment",
        patientContext: adjustment.rationale
      });
    },
    onSuccess: () => {
      toast({ title: "Flagged for review", description: "This adjustment has been sent to your care team for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/progress-feedback", patientId] });
      setFlagDialogOpen(false);
      setSelectedAdjustment(null);
      setFlagNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create clinician flag", variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No progress feedback available. Start logging your health data to receive personalized insights.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const improvingTrends = feedback.dataTrends.filter(t => t.direction === "shows upward").length;
  const pendingFlags = feedback.clinicianFlags.filter(f => f.status === "pending").length;

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Brain className="w-6 h-6 text-primary" />
              AI Progress Feedback
            </h1>
            <p className="text-muted-foreground">
              Personalized insights and feedback on your health journey
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Insights
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Improving Trends</p>
                  <p className="text-2xl font-bold" data-testid="text-improving-count">{improvingTrends}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Goals</p>
                  <p className="text-2xl font-bold" data-testid="text-goals-count">{feedback.goalProgressFeedback.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Patterns Found</p>
                  <p className="text-2xl font-bold" data-testid="text-patterns-count">{feedback.patternInsights.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Flag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Flags</p>
                  <p className="text-2xl font-bold" data-testid="text-flags-count">{pendingFlags}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Your Progress Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed" data-testid="text-progress-summary">{feedback.overallProgressSummary}</p>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="encouragement" data-testid="tab-encouragement">Encouragement</TabsTrigger>
            <TabsTrigger value="adjustments" data-testid="tab-adjustments">Adjustments</TabsTrigger>
            <TabsTrigger value="flags" data-testid="tab-flags">Flags</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    Strengths Identified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feedback.strengthsIdentified.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-strength-${idx}`}>
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Areas for Focus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feedback.areasForFocus.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-focus-${idx}`}>
                        <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Next Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {feedback.nextMilestones.map((milestone, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50" data-testid={`card-milestone-${idx}`}>
                      <Target className="w-4 h-4 text-primary" />
                      <span className="text-sm">{milestone}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedback.dataTrends.map((trend, idx) => {
                const Icon = dataTypeIcons[trend.dataType] || Activity;
                return (
                  <Card key={idx} data-testid={`card-trend-${idx}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{dataTypeLabels[trend.dataType]}</span>
                        </div>
                        <Badge variant={trend.direction === "shows upward" ? "default" : trend.direction === "shows downward" ? "destructive" : "secondary"}>
                          <TrendIcon direction={trend.direction} />
                          <span className="ml-1">{trend.direction}</span>
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{trend.metricName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-2xl font-bold">{trend.currentValue}</span>
                          <span className="text-sm text-muted-foreground ml-1">{trend.unit}</span>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm">
                            {trend.percentChange > 0 ? (
                              <ArrowUpRight className="w-3 h-3 text-green-500" />
                            ) : trend.percentChange < 0 ? (
                              <ArrowDownRight className="w-3 h-3 text-red-500" />
                            ) : null}
                            <span className={trend.percentChange > 0 ? "text-green-600" : trend.percentChange < 0 ? "text-red-600" : ""}>
                              {Math.abs(trend.percentChange).toFixed(1)}%
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{trend.timeframe}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{trend.analysis}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Pattern Insights
                </CardTitle>
                <CardDescription>Patterns discovered in your logged data</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {feedback.patternInsights.map((pattern, idx) => (
                    <AccordionItem key={pattern.id} value={pattern.id} data-testid={`accordion-pattern-${idx}`}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="capitalize">{pattern.patternType}</Badge>
                          <span>{pattern.title}</span>
                          <Badge variant="secondary" className="ml-2">{pattern.confidence} confidence</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <p className="text-sm">{pattern.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {pattern.relatedMetrics.map((metric, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{metric}</Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>Implications:</strong> {pattern.implications}
                        </p>
                        <p className="text-xs text-muted-foreground">Timespan: {pattern.timespan}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4 mt-6">
            {feedback.goalProgressFeedback.map((goal, idx) => (
              <Card key={goal.goalId} data-testid={`card-goal-${idx}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{goal.goalTitle}</CardTitle>
                      <CardDescription>{goal.goalType.replace(/_/g, " ")}</CardDescription>
                    </div>
                    <TrajectoryBadge trajectory={goal.trajectory} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {goal.currentValue} / {goal.targetValue} {goal.unit}
                      </span>
                    </div>
                    <Progress value={goal.progressPercent} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{goal.progressPercent.toFixed(0)}% complete</span>
                      <span>Est. completion: {goal.estimatedCompletion}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{goal.recentTrend.replace(/_/g, " ")}</Badge>
                  </div>

                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{goal.feedbackMessage}</p>

                  {goal.celebrationMilestone && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Star className="w-5 h-5 text-amber-500" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {goal.celebrationMilestone}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="encouragement" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedback.encouragementMessages.map((msg, idx) => (
                <Card key={msg.id} className={
                  msg.intensity === "enthusiastic" ? "border-amber-300 dark:border-amber-700" : ""
                } data-testid={`card-encouragement-${idx}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${
                        msg.type === "celebration" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                        msg.type === "recognition" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" :
                        msg.type === "support" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                        "bg-green-100 dark:bg-green-900/30 text-green-600"
                      }`}>
                        <EncouragementIcon type={msg.type} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{msg.title}</CardTitle>
                        <Badge variant="outline" className="text-xs capitalize">{msg.type}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs text-muted-foreground">Based on: {msg.basedOn}</p>
                    {msg.actionPrompt && (
                      <p className="text-sm font-medium text-primary">{msg.actionPrompt}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Personalized Tips
                </CardTitle>
                <CardDescription>Based on your unique patterns and progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedback.motivationalTips.map((tip, idx) => (
                    <div key={tip.id} className="p-4 border rounded-lg space-y-2" data-testid={`card-tip-${idx}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{tip.category}</Badge>
                      </div>
                      <p className="text-sm font-medium">{tip.tip}</p>
                      <p className="text-xs text-muted-foreground">{tip.rationale}</p>
                      <p className="text-xs text-muted-foreground italic">{tip.applicability}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adjustments" className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground mb-4">
              These are personalized observations based on your data. Items requiring clinical review can be flagged for your care team.
            </p>
            {feedback.suggestedAdjustments.map((adj, idx) => (
              <Card key={adj.id} data-testid={`card-adjustment-${idx}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{adj.title}</CardTitle>
                      <Badge variant="outline" className="capitalize mt-1">{adj.type.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={adj.priority === "high" ? "destructive" : adj.priority === "medium" ? "default" : "secondary"}>
                        {adj.priority} priority
                      </Badge>
                      {adj.requiresClinicianReview && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Review Needed
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Current State</p>
                      <p>{adj.currentState}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Observation</p>
                      <p>{adj.suggestedChange}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{adj.rationale}</p>
                  <p className="text-sm"><strong>Expected Impact:</strong> {adj.expectedImpact}</p>
                  
                  {adj.requiresClinicianReview && (
                    <div className="pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedAdjustment(adj);
                          setFlagDialogOpen(true);
                        }}
                        data-testid={`button-flag-${adj.id}`}
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Flag for Clinician Review
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="flags" className="space-y-4 mt-6">
            {feedback.clinicianFlags.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">No items currently flagged for clinician review.</p>
                </CardContent>
              </Card>
            ) : (
              feedback.clinicianFlags.map((flag, idx) => (
                <Card key={flag.id} className={
                  flag.severity === "urgent" ? "border-red-500" :
                  flag.severity === "high" ? "border-orange-500" :
                  flag.severity === "medium" ? "border-amber-500" : ""
                } data-testid={`card-flag-${idx}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{flag.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="capitalize">{flag.category.replace(/_/g, " ")}</Badge>
                          <Badge variant={
                            flag.severity === "urgent" ? "destructive" :
                            flag.severity === "high" ? "destructive" :
                            flag.severity === "medium" ? "default" : "secondary"
                          }>{flag.severity}</Badge>
                        </div>
                      </div>
                      <Badge variant={
                        flag.status === "pending" ? "outline" :
                        flag.status === "reviewed" ? "default" :
                        flag.status === "addressed" ? "default" : "secondary"
                      } className="capitalize">{flag.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{flag.description}</p>
                    
                    {flag.relatedData.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Related Data:</p>
                        {flag.relatedData.map((data, i) => (
                          <div key={i} className="text-xs bg-muted/50 p-2 rounded">
                            <span className="font-medium">{data.metric}:</span> {data.values} ({data.trend})
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-sm"><strong>Suggested Action:</strong> {flag.suggestedAction}</p>
                    <p className="text-xs text-muted-foreground">{flag.patientContext}</p>
                    <p className="text-xs text-muted-foreground">Flagged: {new Date(flag.flaggedAt).toLocaleString()}</p>
                    
                    {flag.reviewedBy && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm"><strong>Reviewed by:</strong> {flag.reviewedBy}</p>
                        {flag.reviewNotes && <p className="text-sm mt-1">{flag.reviewNotes}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Flag for Clinician Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedAdjustment && (
                <>
                  <div>
                    <FieldCaption>Adjustment</FieldCaption>
                    <p className="text-sm font-medium">{selectedAdjustment.title}</p>
                  </div>
                  <div>
                    <FieldCaption>Reason for Review</FieldCaption>
                    <p className="text-sm text-muted-foreground">{selectedAdjustment.clinicianReviewReason}</p>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional context for your care team..."
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => selectedAdjustment && createFlagMutation.mutate(selectedAdjustment)}
                disabled={createFlagMutation.isPending}
                data-testid="button-submit-flag"
              >
                {createFlagMutation.isPending ? "Submitting..." : "Submit for Review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
