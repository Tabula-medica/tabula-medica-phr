import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Route,
  TrendingUp,
  BookOpen,
  Bell,
  Target,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Calendar,
  Pill,
  Stethoscope,
  GraduationCap,
  Heart,
  ChevronRight,
  RefreshCw,
  Send,
  Award,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect } from "react";

export default function PersonalizedCareJourneyPage() {
  useSEO({ title: "Personalized Care Journey | Tabula Medica" });
  const [activeTab, setActiveTab] = useState("journey");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const { toast } = useToast();

  const { data: patientsData } = useQuery<{ patients: Array<{ patientId: string; name: string; conditions: string[] }> }>({
    queryKey: ["/api/care-journey/patients"],
  });

  useEffect(() => {
    if (!selectedPatientId && patientsData?.patients?.length) {
      setSelectedPatientId(patientsData.patients[0].patientId);
    }
  }, [selectedPatientId, patientsData?.patients]);

  const { data: journeyData, isLoading: journeyLoading } = useQuery({
    queryKey: [`/api/care-journey/journeys?patientId=${selectedPatientId}`],
    enabled: !!selectedPatientId,
  });

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: [`/api/care-journey/recommendations/${selectedPatientId}`],
    enabled: !!selectedPatientId,
  });

  const { data: educationData, isLoading: educationLoading } = useQuery({
    queryKey: [`/api/care-journey/education/${selectedPatientId}`],
    enabled: !!selectedPatientId,
  });

  const { data: remindersData, isLoading: remindersLoading } = useQuery({
    queryKey: [`/api/care-journey/reminders/${selectedPatientId}`],
    enabled: !!selectedPatientId,
  });

  const createJourneyMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest("POST", "/api/care-journey/journeys", {
        patientId,
        journeyType: "Comprehensive Care Management",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Journey Created", description: "Personalized care journey has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-journey/journeys"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { patientId: string; feedback?: string; completedTasks?: string[] }) => {
      const response = await apiRequest("POST", `/api/care-journey/progress/${data.patientId}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Progress Updated", description: `${data.adaptations?.length || 0} adaptations made to your journey.` });
      queryClient.invalidateQueries({ queryKey: ["/api/care-journey"] });
      setFeedback("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const journey = (journeyData as any)?.journeys?.[0];
  const recommendations = (recommendationsData as any)?.recommendations || [];
  const education = (educationData as any)?.content || [];
  const reminders = (remindersData as any)?.reminders || [];

  const priorityColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-600 border-red-500/30",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    low: "bg-green-500/10 text-green-600 border-green-500/30",
    urgent: "bg-red-500/10 text-red-600 border-red-500/30",
    normal: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  };

  const taskTypeIcons: Record<string, JSX.Element> = {
    medication: <Pill className="h-4 w-4" />,
    appointment: <Calendar className="h-4 w-4" />,
    education: <BookOpen className="h-4 w-4" />,
    lifestyle: <Heart className="h-4 w-4" />,
    assessment: <Stethoscope className="h-4 w-4" />,
  };

  const contentTypeIcons: Record<string, JSX.Element> = {
    article: <BookOpen className="h-4 w-4" />,
    video: <Activity className="h-4 w-4" />,
    infographic: <Target className="h-4 w-4" />,
    quiz: <GraduationCap className="h-4 w-4" />,
    checklist: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Route className="h-6 w-6" />
            Personalized Care Journey
          </h1>
          <p className="text-muted-foreground">AI-driven treatment plans, education, and adaptive reminders</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-48" data-testid="select-patient">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {patientsData?.patients?.map(p => (
                <SelectItem key={p.patientId} value={p.patientId} data-testid={`option-patient-${p.patientId}`}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => selectedPatientId && createJourneyMutation.mutate(selectedPatientId)}
            disabled={!selectedPatientId || createJourneyMutation.isPending}
            data-testid="button-create-journey"
          >
            {createJourneyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            New Journey
          </Button>
        </div>
      </div>

      <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-no-cds">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Not clinical decision support.</strong> All content is for patient engagement and education. Treatment decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      {selectedPatientId && journey && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-progress">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-bold" data-testid="text-progress">{journey.progress?.overallProgress || 0}%</p>
                  <Progress value={journey.progress?.overallProgress || 0} className="mt-2 h-2" />
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-adherence">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Medication Adherence</p>
                  <p className="text-2xl font-bold">{journey.progress?.adherenceRate || 0}%</p>
                </div>
                <Pill className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-engagement">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Engagement Score</p>
                  <p className="text-2xl font-bold">{journey.progress?.engagementScore || 0}</p>
                </div>
                <Heart className="h-8 w-8 text-pink-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-milestones">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Milestones</p>
                  <p className="text-2xl font-bold">{journey.progress?.completedMilestones || 0}/{journey.progress?.totalMilestones || 0}</p>
                </div>
                <Award className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl" data-testid="tabs-journey">
          <TabsTrigger value="journey" data-testid="tab-journey">
            <Route className="h-4 w-4 mr-2" />
            Journey
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Sparkles className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">
            <BookOpen className="h-4 w-4 mr-2" />
            Education
          </TabsTrigger>
          <TabsTrigger value="reminders" data-testid="tab-reminders">
            <Bell className="h-4 w-4 mr-2" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="adapt" data-testid="tab-adapt">
            <RefreshCw className="h-4 w-4 mr-2" />
            Adapt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journey" className="space-y-6">
          {journeyLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : journey ? (
            <div className="space-y-6">
              <Card data-testid="card-journey-overview">
                <CardHeader>
                  <CardTitle>Care Journey: {journey.journeyType}</CardTitle>
                  <CardDescription>Primary condition: {journey.primaryCondition}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="outline">{journey.status}</Badge>
                    <span className="text-sm text-muted-foreground">Created: {new Date(journey.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>

              {journey.phases?.map((phase: any, idx: number) => (
                <Card key={phase.phaseId} data-testid={`card-phase-${idx}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {phase.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : phase.status === "in_progress" ? (
                            <Clock className="h-5 w-5 text-blue-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                          Phase {idx + 1}: {phase.phaseName}
                        </CardTitle>
                        <CardDescription>{phase.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className={phase.status === "in_progress" ? "border-blue-500/30 text-blue-600" : ""}>
                        {phase.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Milestones</h4>
                      <div className="space-y-2">
                        {phase.milestones?.map((m: any, mi: number) => (
                          <div key={m.milestoneId} className="flex items-center gap-3" data-testid={`milestone-${idx}-${mi}`}>
                            <Checkbox checked={m.completed} disabled />
                            <span className={m.completed ? "line-through text-muted-foreground" : ""}>{m.title}</span>
                            <span className="text-xs text-muted-foreground ml-auto">Due: {m.targetDate}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Tasks</h4>
                      <div className="space-y-2">
                        {phase.tasks?.map((t: any, ti: number) => (
                          <div key={t.taskId} className="flex items-center gap-3 p-2 rounded border" data-testid={`task-${idx}-${ti}`}>
                            <Checkbox checked={t.completed} disabled />
                            <span className="flex items-center gap-2">
                              {taskTypeIcons[t.type] || <Target className="h-4 w-4" />}
                              {t.title}
                            </span>
                            <Badge variant="outline" className={`ml-auto ${priorityColors[t.priority]}`}>
                              {t.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No care journey found. Create one to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card data-testid="card-recommendations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Treatment Recommendations
              </CardTitle>
              <CardDescription>Personalized suggestions based on your health profile</CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec: any, i: number) => (
                    <div key={rec.recommendationId} className="p-4 rounded-lg border" data-testid={`recommendation-${i}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            {rec.type === "lifestyle" && <Heart className="h-4 w-4 text-pink-500" />}
                            {rec.type === "monitoring" && <Activity className="h-4 w-4 text-blue-500" />}
                            {rec.type === "therapy" && <Stethoscope className="h-4 w-4 text-green-500" />}
                            {rec.type === "specialist" && <GraduationCap className="h-4 w-4 text-purple-500" />}
                            {rec.title}
                          </h4>
                          <Badge variant="outline" className="text-xs mt-1">{rec.type}</Badge>
                        </div>
                        <Badge variant="outline" className={priorityColors[rec.priority]}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="bg-muted/50 p-2 rounded text-sm">
                        <strong>Why this matters:</strong> {rec.rationale}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">Evidence: {rec.evidenceLevel}</Badge>
                        <span className="text-xs text-muted-foreground">{rec.estimatedBenefit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Select a patient to see personalized recommendations.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education" className="space-y-6">
          <Card data-testid="card-education">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Personalized Education Content
              </CardTitle>
              <CardDescription>Learning resources tailored to your conditions and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              {educationLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : education.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {education.map((edu: any, i: number) => (
                    <Card key={edu.contentId} className="hover-elevate cursor-pointer" data-testid={`education-${i}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          {contentTypeIcons[edu.type] || <BookOpen className="h-4 w-4" />}
                          <Badge variant="secondary">{edu.type}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{edu.estimatedDuration}</span>
                        </div>
                        <CardTitle className="text-base">{edu.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{edu.personalizedReason}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Key Takeaways:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {edu.keyTakeaways?.slice(0, 2).map((t: string, ti: number) => (
                              <li key={ti} className="flex items-start gap-1">
                                <ArrowRight className="h-3 w-3 mt-0.5" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Badge variant="outline" className="text-xs">{edu.readingLevel}</Badge>
                          <Progress value={edu.relevanceScore * 100} className="w-20 h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Select a patient to see personalized education content.</p>
              )}
            </CardContent>
          </Card>

          {(educationData as any)?.learningPath && (
            <Card data-testid="card-learning-path">
              <CardHeader>
                <CardTitle>Suggested Learning Path</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(educationData as any).learningPath.map((topic: string, i: number) => (
                    <Badge key={i} variant="outline" className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">{i + 1}</span>
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reminders" className="space-y-6">
          <Card data-testid="card-reminders">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Adaptive Reminders
              </CardTitle>
              <CardDescription>Personalized reminders that adapt to your progress and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : reminders.length > 0 ? (
                <div className="space-y-4">
                  {reminders.map((rem: any, i: number) => (
                    <div key={rem.reminderId} className="p-4 rounded-lg border flex items-start gap-4" data-testid={`reminder-${i}`}>
                      <div className={`p-2 rounded-full ${rem.type === "medication" ? "bg-blue-500/10" : rem.type === "appointment" ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                        {rem.type === "medication" && <Pill className="h-5 w-5 text-blue-500" />}
                        {rem.type === "appointment" && <Calendar className="h-5 w-5 text-green-500" />}
                        {rem.type === "followup" && <Stethoscope className="h-5 w-5 text-amber-500" />}
                        {rem.type === "goal_check" && <Target className="h-5 w-5 text-purple-500" />}
                        {rem.type === "refill" && <RefreshCw className="h-5 w-5 text-pink-500" />}
                        {rem.type === "assessment" && <Activity className="h-5 w-5 text-indigo-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{rem.title}</h4>
                          <Badge variant="outline" className={priorityColors[rem.priority]}>
                            {rem.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rem.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(rem.scheduledDate).toLocaleString()}
                          </span>
                          {rem.recurrence && rem.recurrence !== "once" && (
                            <Badge variant="secondary" className="text-xs">{rem.recurrence}</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{rem.channel}</Badge>
                        </div>
                        {rem.adaptiveFactors && rem.adaptiveFactors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {rem.adaptiveFactors.map((f: string, fi: number) => (
                              <span key={fi} className="text-xs bg-muted px-2 py-0.5 rounded">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Select a patient to see personalized reminders.</p>
              )}

              {(remindersData as any)?.adaptationReason && (
                <Alert className="mt-4 border-blue-500/30 bg-blue-500/10" data-testid="alert-adaptation">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                    {(remindersData as any).adaptationReason}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adapt" className="space-y-6">
          <Card data-testid="card-adapt">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Provide Feedback & Adapt Journey
              </CardTitle>
              <CardDescription>Share your progress and feedback to personalize your care journey</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">How are you feeling about your care journey?</label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share any challenges, successes, or concerns..."
                  className="mt-2"
                  data-testid="input-feedback"
                />
              </div>

              <Button
                onClick={() => selectedPatientId && updateProgressMutation.mutate({ patientId: selectedPatientId, feedback })}
                disabled={!selectedPatientId || !feedback || updateProgressMutation.isPending}
                data-testid="button-submit-feedback"
              >
                {updateProgressMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Submit & Adapt</>
                )}
              </Button>

              {updateProgressMutation.data && (
                <div className="space-y-4 mt-6" data-testid="section-adaptations">
                  <h4 className="font-medium">Journey Adaptations Made:</h4>
                  {(updateProgressMutation.data as any).adaptations?.map((a: any, i: number) => (
                    <div key={i} className="p-3 rounded border" data-testid={`adaptation-${i}`}>
                      <p className="font-medium text-sm">{a.reason}</p>
                      <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                        {a.changes?.map((c: string, ci: number) => (
                          <li key={ci} className="flex items-start gap-1">
                            <CheckCircle2 className="h-3 w-3 mt-1 text-green-500" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <h4 className="font-medium mt-4">Suggested Next Steps:</h4>
                  <ul className="space-y-2">
                    {(updateProgressMutation.data as any).nextSteps?.map((step: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm" data-testid={`next-step-${i}`}>
                        <ArrowRight className="h-4 w-4 text-primary" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center" data-testid="text-disclaimer">
        {journey?.disclaimer || (recommendationsData as any)?.disclaimer || (educationData as any)?.disclaimer || "This is NOT clinical decision support. All treatment decisions must be made by qualified healthcare professionals."}
      </p>
    </div>
  );
}
