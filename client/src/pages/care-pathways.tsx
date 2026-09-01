import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Route, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertTriangle, 
  Bell, 
  BookOpen, 
  Target,
  TrendingUp,
  Flame,
  Users,
  Calendar,
  PlayCircle,
  PauseCircle,
  Award,
  Lightbulb,
  Activity,
  Heart,
  Pill,
  Footprints,
  Sparkles
} from "lucide-react";

interface PathwayTask {
  id: string;
  stageId: string;
  title: string;
  description: string;
  taskType: string;
  frequency: string;
  priority: string;
  estimatedMinutes: number;
  requiredForProgress: boolean;
  reminderEnabled: boolean;
}

interface EducationalContent {
  id: string;
  stageId: string;
  title: string;
  description: string;
  contentType: string;
  difficultyLevel: string;
  estimatedMinutes: number;
  tags: string[];
}

interface PathwayStage {
  id: string;
  name: string;
  description: string;
  order: number;
  durationDays: number;
  tasks: PathwayTask[];
  educationalContent: EducationalContent[];
}

interface CarePathway {
  id: string;
  name: string;
  description: string;
  condition: string;
  conditionCode: string;
  version: string;
  isActive: boolean;
  stages: PathwayStage[];
  estimatedDurationWeeks: number;
  targetOutcomes: string[];
  eligibilityCriteria: string[];
}

interface PatientPathway {
  id: string;
  patientId: string;
  pathwayId: string;
  assignedBy: string;
  status: string;
  currentStageId: string;
  overallProgress: number;
  adherenceScore: number;
  startDate: string;
  expectedEndDate: string;
  lastActivityAt: string;
  pathway?: CarePathway;
}

interface PathwayNudge {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
  readAt?: string;
  noCdsDisclaimer: string;
}

interface AdherenceAnalytics {
  overallAdherence: number;
  taskAdherence: number;
  educationAdherence: number;
  streakDays: number;
  missedTasks: number;
  completedTasks: number;
  totalTasks: number;
  riskLevel: string;
  riskFactors: string[];
  stageProgress: { stageId: string; stageName: string; progress: number }[];
}

interface AIContentRecommendation {
  contentId: string;
  title: string;
  reason: string;
  relevanceScore: number;
  contentType: string;
  estimatedMinutes: number;
  noCdsDisclaimer: string;
}

interface AITaskRecommendation {
  taskId: string;
  title: string;
  reason: string;
  priorityAdjustment: string;
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER = "This information is for educational and motivational purposes only and does NOT constitute clinical decision support or medical advice. Always consult your healthcare provider for personalized medical decisions.";

export default function CarePathwaysPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("my-pathways");
  const [selectedPathway, setSelectedPathway] = useState<PatientPathway | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedPathwayToAssign, setSelectedPathwayToAssign] = useState<CarePathway | null>(null);
  const [assignNotes, setAssignNotes] = useState("");

  const patientId = "patient-1";
  const providerId = "provider-dr-smith";

  const { data: allPathways } = useQuery<CarePathway[]>({
    queryKey: ["/api/care-pathways/pathways"],
  });

  const { data: patientPathways } = useQuery<PatientPathway[]>({
    queryKey: ["/api/care-pathways/patient", patientId, "pathways"],
  });

  const { data: adherenceData } = useQuery<AdherenceAnalytics>({
    queryKey: ["/api/care-pathways/assignments", selectedPathway?.id, "adherence"],
    enabled: !!selectedPathway,
  });

  const { data: nudges } = useQuery<PathwayNudge[]>({
    queryKey: ["/api/care-pathways/patient", patientId, "nudges"],
  });

  const { data: contentRecommendations } = useQuery<AIContentRecommendation[]>({
    queryKey: ["/api/care-pathways/assignments", selectedPathway?.id, "recommendations/content"],
    enabled: !!selectedPathway,
  });

  const { data: taskRecommendations } = useQuery<AITaskRecommendation[]>({
    queryKey: ["/api/care-pathways/assignments", selectedPathway?.id, "recommendations/tasks"],
    enabled: !!selectedPathway,
  });

  const assignPathwayMutation = useMutation({
    mutationFn: async (data: { pathwayId: string; patientId: string; providerId: string; notes?: string }) => {
      return apiRequest("POST", "/api/care-pathways/assignments", data);
    },
    onSuccess: () => {
      toast({ title: "Pathway Assigned", description: "The care pathway has been assigned successfully." });
      setShowAssignDialog(false);
      setAssignNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/care-pathways/patient"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (data: { patientPathwayId: string; taskId: string; measuredValue?: number; measuredUnit?: string }) => {
      return apiRequest("POST", `/api/care-pathways/assignments/${data.patientPathwayId}/tasks/${data.taskId}/complete`, {
        measuredValue: data.measuredValue,
        measuredUnit: data.measuredUnit
      });
    },
    onSuccess: () => {
      toast({ title: "Task Completed", description: "Great job completing this task!" });
      queryClient.invalidateQueries({ queryKey: ["/api/care-pathways"] });
    }
  });

  const engageContentMutation = useMutation({
    mutationFn: async (data: { patientPathwayId: string; contentId: string; progressPercent: number }) => {
      return apiRequest("POST", `/api/care-pathways/assignments/${data.patientPathwayId}/content/${data.contentId}/engage`, {
        progressPercent: data.progressPercent
      });
    },
    onSuccess: () => {
      toast({ title: "Content Completed", description: "Educational content marked as completed." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-pathways"] });
    }
  });

  const markNudgeReadMutation = useMutation({
    mutationFn: async (nudgeId: string) => {
      return apiRequest("PATCH", `/api/care-pathways/patient/${patientId}/nudges/${nudgeId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-pathways/patient", patientId, "nudges"] });
    }
  });

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'medication': return <Pill className="h-4 w-4" />;
      case 'exercise': return <Footprints className="h-4 w-4" />;
      case 'monitoring': return <Activity className="h-4 w-4" />;
      case 'diet': return <Heart className="h-4 w-4" />;
      case 'appointment': return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getNudgeIcon = (type: string) => {
    switch (type) {
      case 'encouragement': return <Award className="h-4 w-4 text-yellow-500" />;
      case 'milestone': return <Target className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'reminder': return <Bell className="h-4 w-4 text-blue-500" />;
      case 'educational': return <BookOpen className="h-4 w-4 text-purple-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'low': return 'secondary';
      case 'medium': return 'outline';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  const unreadNudges = nudges?.filter(n => !n.readAt) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Route className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Care Pathways</h1>
            <p className="text-muted-foreground">AI-driven condition-specific care management</p>
          </div>
        </div>
        {unreadNudges.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            {unreadNudges.length} New Notifications
          </Badge>
        )}
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{NO_CDS_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Pathways</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{patientPathways?.filter(p => p.status === 'active').length || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{adherenceData?.overallAdherence || 0}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{adherenceData?.streakDays || 0} days</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{adherenceData?.completedTasks || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="my-pathways" data-testid="tab-my-pathways">
            <Route className="h-4 w-4 mr-2" />
            My Pathways
          </TabsTrigger>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse Pathways
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
            {unreadNudges.length > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadNudges.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-pathways" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Route className="h-4 w-4" />
                Your Active Pathways
              </h3>
              {patientPathways?.filter(pp => pp.status === 'active').map(pp => (
                <Card 
                  key={pp.id} 
                  className={`cursor-pointer transition-all ${selectedPathway?.id === pp.id ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                  onClick={() => setSelectedPathway(pp)}
                  data-testid={`pathway-card-${pp.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{pp.pathway?.name}</CardTitle>
                      <Badge variant={pp.status === 'active' ? 'default' : 'secondary'}>
                        {pp.status}
                      </Badge>
                    </div>
                    <CardDescription>{pp.pathway?.condition}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">{pp.overallProgress}%</span>
                      </div>
                      <Progress value={pp.overallProgress} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Adherence: {pp.adherenceScore}%</span>
                        <span>{pp.pathway?.stages.length} stages</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!patientPathways || patientPathways.filter(pp => pp.status === 'active').length === 0) && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Route className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active pathways</p>
                    <p className="text-sm text-muted-foreground">Browse available pathways to get started</p>
                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>
                      Browse Pathways
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {selectedPathway ? (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selectedPathway.pathway?.name}</CardTitle>
                          <CardDescription>{selectedPathway.pathway?.description}</CardDescription>
                        </div>
                        {adherenceData && (
                          <Badge variant={getRiskBadgeVariant(adherenceData.riskLevel)}>
                            {adherenceData.riskLevel} risk
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {adherenceData && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{adherenceData.taskAdherence}%</div>
                            <div className="text-xs text-muted-foreground">Task Adherence</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{adherenceData.educationAdherence}%</div>
                            <div className="text-xs text-muted-foreground">Education</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold flex items-center justify-center gap-1">
                              <Flame className="h-5 w-5 text-orange-500" />
                              {adherenceData.streakDays}
                            </div>
                            <div className="text-xs text-muted-foreground">Day Streak</div>
                          </div>
                        </div>
                      )}

                      {adherenceData?.riskFactors && adherenceData.riskFactors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Risk Factors:</strong> {adherenceData.riskFactors.join(", ")}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Current Stage Tasks</CardTitle>
                      <CardDescription>
                        {selectedPathway.pathway?.stages.find(s => s.id === selectedPathway.currentStageId)?.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedPathway.pathway?.stages
                          .find(s => s.id === selectedPathway.currentStageId)
                          ?.tasks.map(task => (
                            <div 
                              key={task.id} 
                              className="flex items-center justify-between p-3 border rounded-lg"
                              data-testid={`task-${task.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {getTaskIcon(task.taskType)}
                                <div>
                                  <div className="font-medium">{task.title}</div>
                                  <div className="text-sm text-muted-foreground">{task.description}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">{task.frequency}</Badge>
                                    <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                      {task.priority}
                                    </Badge>
                                    {task.requiredForProgress && (
                                      <Badge className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button 
                                size="sm"
                                onClick={() => completeTaskMutation.mutate({
                                  patientPathwayId: selectedPathway.id,
                                  taskId: task.id
                                })}
                                disabled={completeTaskMutation.isPending}
                                data-testid={`complete-task-${task.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Educational Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedPathway.pathway?.stages
                          .find(s => s.id === selectedPathway.currentStageId)
                          ?.educationalContent.map(content => (
                            <div 
                              key={content.id} 
                              className="flex items-center justify-between p-3 border rounded-lg"
                              data-testid={`content-${content.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <div>
                                  <div className="font-medium">{content.title}</div>
                                  <div className="text-sm text-muted-foreground">{content.description}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">{content.contentType}</Badge>
                                    <Badge variant="secondary" className="text-xs">{content.difficultyLevel}</Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {content.estimatedMinutes} min
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => engageContentMutation.mutate({
                                  patientPathwayId: selectedPathway.id,
                                  contentId: content.id,
                                  progressPercent: 100
                                })}
                                disabled={engageContentMutation.isPending}
                                data-testid={`complete-content-${content.id}`}
                              >
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Start
                              </Button>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center">
                    <Route className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">Select a Pathway</h3>
                    <p className="text-muted-foreground">Choose a pathway from the left to view details and tasks</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="browse" className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Available Care Pathways
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allPathways?.map(pathway => (
              <Card key={pathway.id} data-testid={`browse-pathway-${pathway.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{pathway.name}</CardTitle>
                    <Badge>{pathway.condition}</Badge>
                  </div>
                  <CardDescription>{pathway.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{pathway.estimatedDurationWeeks} weeks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-muted-foreground" />
                      <span>{pathway.stages.length} stages</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Target Outcomes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {pathway.targetOutcomes.slice(0, 3).map((outcome, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Target className="h-3 w-3 mt-1 text-primary" />
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Dialog open={showAssignDialog && selectedPathwayToAssign?.id === pathway.id} onOpenChange={(open) => {
                      setShowAssignDialog(open);
                      if (!open) setSelectedPathwayToAssign(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => setSelectedPathwayToAssign(pathway)}
                          data-testid={`assign-pathway-${pathway.id}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Assign to Patient
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Pathway</DialogTitle>
                          <DialogDescription>
                            Assign "{pathway.name}" to a patient. This will create a personalized care journey with tasks and educational content.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            {/* Rendered once per pathway, so a shared id would
                                collide; the control is named directly instead. */}
                            <span className="text-sm font-medium">Notes (Optional)</span>
                            <Textarea
                              aria-label="Notes (Optional)"
                              placeholder="Add any notes for this assignment..."
                              value={assignNotes}
                              onChange={(e) => setAssignNotes(e.target.value)}
                              data-testid="assign-notes"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => assignPathwayMutation.mutate({
                              pathwayId: pathway.id,
                              patientId,
                              providerId,
                              notes: assignNotes
                            })}
                            disabled={assignPathwayMutation.isPending}
                            data-testid="confirm-assign"
                          >
                            Assign Pathway
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Your Notifications & Nudges
          </h3>
          <div className="space-y-3">
            {nudges?.map(nudge => (
              <Card 
                key={nudge.id} 
                className={nudge.readAt ? 'opacity-60' : ''}
                data-testid={`nudge-${nudge.id}`}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="mt-1">
                    {getNudgeIcon(nudge.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{nudge.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant={nudge.priority === 'high' ? 'destructive' : 'secondary'}>
                          {nudge.priority}
                        </Badge>
                        {!nudge.readAt && (
                          <Badge>New</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{nudge.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(nudge.createdAt).toLocaleDateString()}
                      </span>
                      {!nudge.readAt && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => markNudgeReadMutation.mutate(nudge.id)}
                          data-testid={`mark-read-${nudge.id}`}
                        >
                          Mark as Read
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">{nudge.noCdsDisclaimer}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!nudges || nudges.length === 0) && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground">You'll receive personalized nudges and reminders here</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Alert className="mb-4">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              {NO_CDS_DISCLAIMER}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Recommended Tasks
              </h3>
              {taskRecommendations?.map(rec => (
                <Card key={rec.taskId} data-testid={`task-rec-${rec.taskId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                        {rec.priorityAdjustment === 'increase' && (
                          <Badge variant="destructive" className="mt-2">High Priority</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 italic">{rec.noCdsDisclaimer}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Do Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!taskRecommendations || taskRecommendations.length === 0) && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>All tasks completed for today!</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Recommended Content
              </h3>
              {contentRecommendations?.map(rec => (
                <Card key={rec.contentId} data-testid={`content-rec-${rec.contentId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rec.title}</h4>
                          <Badge variant="outline">{rec.contentType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {rec.estimatedMinutes} min
                          <span className="text-primary font-medium">
                            {rec.relevanceScore}% relevant
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 italic">{rec.noCdsDisclaimer}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!contentRecommendations || contentRecommendations.length === 0) && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2" />
                    <p>No content recommendations available</p>
                    <p className="text-sm">Select a pathway to see recommendations</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
