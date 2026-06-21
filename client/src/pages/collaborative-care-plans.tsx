import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Users,
  History,
  Sparkles,
  CheckCircle,
  Clock,
  Target,
  Activity,
  Lock,
  Unlock,
  Plus,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  Eye,
  Edit3,
  UserPlus,
  Shield,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  RefreshCw,
  Calendar,
  ClipboardCheck,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/components/shared/format-helpers";
import { getStatusColor } from "@/components/shared/ui-helpers";
import type {
  CollaborativeCarePlan,
  CarePlanContributor,
  CarePlanVersion,
  CarePlanChange,
  CarePlanAcknowledgment,
  CarePlanSuggestion,
} from "@shared/schema";

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case "worsening":
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

function getContributorRoleColor(role: string): string {
  switch (role) {
    case "owner":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "editor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "approver":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "reviewer":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "viewer":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function CarePlansListView() {
  const { toast } = useToast();
  
  const { data: carePlans, isLoading } = useQuery<CollaborativeCarePlan[]>({
    queryKey: ["/api/collaborative-care-plans"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Collaborative Care Plans</h1>
          <p className="text-muted-foreground">Manage and collaborate on patient care plans</p>
        </div>
        <Button data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-2" />
          New Care Plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {carePlans?.map((plan) => (
          <Link key={plan.id} href={`/collaborative-care-plans/${plan.id}`}>
            <Card className="hover-elevate cursor-pointer" data-testid={`card-care-plan-${plan.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">{plan.title}</CardTitle>
                  {plan.isLocked && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </div>
                <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.patientName}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
                  <Badge variant="outline">{plan.category.replace("_", " ")}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{plan.contributorCount} contributors</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    <span>{plan.goals.length} goals</span>
                  </div>
                </div>
                {plan.pendingSuggestionsCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                    <Lightbulb className="h-3 w-3" />
                    <span>{plan.pendingSuggestionsCount} pending suggestions</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Updated {formatDate(plan.updatedAt)}</span>
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>

      {(!carePlans || carePlans.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Care Plans Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Create your first collaborative care plan to start working with your care team.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CarePlanDetailView({ carePlanId }: { carePlanId: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);

  const { data: carePlan, isLoading: loadingPlan } = useQuery<CollaborativeCarePlan>({
    queryKey: ["/api/collaborative-care-plans", carePlanId],
  });

  const { data: contributors } = useQuery<CarePlanContributor[]>({
    queryKey: ["/api/collaborative-care-plans", carePlanId, "contributors"],
  });

  const { data: versions } = useQuery<CarePlanVersion[]>({
    queryKey: ["/api/collaborative-care-plans", carePlanId, "versions"],
  });

  const { data: changes } = useQuery<CarePlanChange[]>({
    queryKey: ["/api/collaborative-care-plans", carePlanId, "changes"],
  });

  const { data: suggestions } = useQuery<CarePlanSuggestion[]>({
    queryKey: ["/api/collaborative-care-plans", carePlanId, "suggestions"],
  });

  const { data: acknowledgments } = useQuery<CarePlanAcknowledgment[]>({
    queryKey: ["/api/collaborative-care-plans", carePlanId, "acknowledgments"],
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/suggestions/generate`, {
        recentVitals: [
          { name: "Blood Pressure", value: "135/85", trend: "stable" },
          { name: "Blood Glucose", value: "140 mg/dL", trend: "improving" },
        ],
        medications: [
          { name: "Metformin", adherence: 85 },
          { name: "Lisinopril", adherence: 72 },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId, "suggestions"] });
      toast({ title: "AI suggestions generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    },
  });

  const reviewSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, status, notes }: { suggestionId: string; status: string; notes?: string }) => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/suggestions/${suggestionId}/review`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId, "suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId] });
      toast({ title: "Suggestion reviewed" });
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/suggestions/${suggestionId}/apply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId, "suggestions"] });
      toast({ title: "Suggestion applied successfully" });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (data: { acknowledgedVia: string; notes?: string }) => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/acknowledge`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId, "acknowledgments"] });
      setShowAcknowledgeDialog(false);
      toast({ title: "Care plan acknowledged successfully" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/lock`, { reason: "Editing in progress" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId] });
      toast({ title: "Care plan locked" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/collaborative-care-plans/${carePlanId}/unlock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-care-plans", carePlanId] });
      toast({ title: "Care plan unlocked" });
    },
  });

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!carePlan) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Care Plan Not Found</h3>
          <Link href="/collaborative-care-plans">
            <Button variant="outline">Back to Care Plans</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const pendingSuggestions = suggestions?.filter(s => s.status === "pending") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/collaborative-care-plans">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-care-plan-title">{carePlan.title}</h1>
            {carePlan.isLocked && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{carePlan.patientName} - v{carePlan.currentVersionNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          {carePlan.isLocked ? (
            <Button variant="outline" onClick={() => unlockMutation.mutate()} data-testid="button-unlock">
              <Unlock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          ) : (
            <Button variant="outline" onClick={() => lockMutation.mutate()} data-testid="button-lock">
              <Lock className="h-4 w-4 mr-2" />
              Lock
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowAcknowledgeDialog(true)} data-testid="button-acknowledge">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Acknowledge
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={getStatusColor(carePlan.status)}>{carePlan.status}</Badge>
        <Badge variant="outline">{carePlan.category.replace("_", " ")}</Badge>
        {carePlan.conditions.map((condition, i) => (
          <Badge key={i} variant="secondary">{condition}</Badge>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <FileText className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="contributors" className="flex items-center gap-2" data-testid="tab-contributors">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2 relative" data-testid="tab-suggestions">
            <Sparkles className="h-4 w-4" />
            AI Suggestions
            {pendingSuggestions.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingSuggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acknowledgments" className="flex items-center gap-2" data-testid="tab-acknowledgments">
            <CheckCircle className="h-4 w-4" />
            Acknowledgments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {carePlan.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{carePlan.description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Goals ({carePlan.goals.length})
                </CardTitle>
                <Button size="sm" data-testid="button-add-goal">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Goal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {carePlan.goals.map((goal) => (
                <div key={goal.id} className="border rounded-lg p-4 space-y-3" data-testid={`goal-${goal.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium">{goal.description}</h4>
                      {goal.targetDate && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Target: {formatDate(goal.targetDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(goal.priority)}>{goal.priority}</Badge>
                      <Badge className={getStatusColor(goal.status)}>{goal.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  {goal.metrics && goal.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {goal.metrics.map((metric, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {metric.name}: {metric.current} / {metric.target} {metric.unit}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {carePlan.goals.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No goals defined yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Interventions ({carePlan.interventions.length})
                </CardTitle>
                <Button size="sm" data-testid="button-add-intervention">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Intervention
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {carePlan.interventions.map((intervention) => (
                <div key={intervention.id} className="border rounded-lg p-4" data-testid={`intervention-${intervention.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{intervention.description}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Frequency: {intervention.frequency} | Assigned to: {intervention.assignedTo}
                      </p>
                    </div>
                    <Badge className={getStatusColor(intervention.status)}>{intervention.status.replace("_", " ")}</Badge>
                  </div>
                </div>
              ))}
              {carePlan.interventions.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No interventions defined yet</p>
              )}
            </CardContent>
          </Card>

          {carePlan.careTeam.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Care Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {carePlan.careTeam.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar>
                        <AvatarFallback>{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{member.name}</p>
                          {member.isPrimary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.role.replace("_", " ")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contributors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contributors ({contributors?.length || 0})</CardTitle>
                <Button size="sm" data-testid="button-add-contributor">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Contributor
                </Button>
              </div>
              <CardDescription>Team members who can view or edit this care plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contributors?.map((contributor) => (
                  <div key={contributor.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`contributor-${contributor.id}`}>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{contributor.userName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contributor.userName}</p>
                        <Badge className={getContributorRoleColor(contributor.contributorRole)}>
                          {contributor.contributorRole}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{contributor.userRole}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {contributor.canEdit && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          Can Edit
                        </Badge>
                      )}
                      {contributor.canApprove && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Can Approve
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {versions?.map((version) => (
                      <div key={version.id} className="border rounded-lg p-3" data-testid={`version-${version.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">v{version.versionNumber}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium">{version.changesSummary}</p>
                        <p className="text-xs text-muted-foreground mt-1">By {version.createdByName}</p>
                      </div>
                    ))}
                    {(!versions || versions.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">No version history yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Change Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {changes?.map((change) => (
                      <div key={change.id} className="border-l-2 border-primary pl-3 py-2" data-testid={`change-${change.id}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">{change.changeType.replace("_", " ")}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(change.changedAt)}</span>
                        </div>
                        <p className="text-sm">{change.fieldPath || "Care plan"}</p>
                        <p className="text-xs text-muted-foreground">By {change.changedByName}</p>
                        {change.reason && (
                          <p className="text-xs text-muted-foreground italic mt-1">{change.reason}</p>
                        )}
                      </div>
                    ))}
                    {(!changes || changes.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">No changes recorded yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI-Powered Suggestions
                  </CardTitle>
                  <CardDescription>Recommendations based on patient data and care plan analysis</CardDescription>
                </div>
                <Button 
                  onClick={() => generateSuggestionsMutation.mutate()}
                  disabled={generateSuggestionsMutation.isPending}
                  data-testid="button-generate-suggestions"
                >
                  {generateSuggestionsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Suggestions
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestions?.map((suggestion) => (
                <div 
                  key={suggestion.id} 
                  className={`border rounded-lg p-4 space-y-3 ${suggestion.status === "pending" ? "border-amber-300 dark:border-amber-700" : ""}`}
                  data-testid={`suggestion-${suggestion.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className={`h-5 w-5 ${suggestion.status === "pending" ? "text-amber-500" : "text-muted-foreground"}`} />
                      <h4 className="font-medium">{suggestion.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(suggestion.priority)}>{suggestion.priority}</Badge>
                      <Badge variant="outline">{suggestion.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                  <div className="bg-muted/50 rounded p-3">
                    <p className="text-sm font-medium mb-1">Rationale</p>
                    <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                  </div>
                  {suggestion.basedOnMetrics && suggestion.basedOnMetrics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestion.basedOnMetrics.map((metric, i) => (
                        <Badge key={i} variant="outline" className="flex items-center gap-1">
                          {getTrendIcon(metric.trend)}
                          {metric.metricName}: {metric.currentValue}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Confidence: {suggestion.confidence}%
                    </div>
                    {suggestion.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => reviewSuggestionMutation.mutate({ suggestionId: suggestion.id, status: "rejected" })}
                          data-testid={`button-reject-${suggestion.id}`}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => reviewSuggestionMutation.mutate({ suggestionId: suggestion.id, status: "accepted" })}
                          data-testid={`button-accept-${suggestion.id}`}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => applySuggestionMutation.mutate(suggestion.id)}
                          data-testid={`button-apply-${suggestion.id}`}
                        >
                          <Wand2 className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>
                  {suggestion.reviewedBy && (
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                      Reviewed by {suggestion.reviewedByName} on {formatDateTime(suggestion.reviewedAt!)}
                      {suggestion.reviewNotes && <p className="italic mt-1">{suggestion.reviewNotes}</p>}
                    </div>
                  )}
                </div>
              ))}
              {(!suggestions || suggestions.length === 0) && (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Suggestions Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate AI-powered suggestions to improve this care plan.
                  </p>
                  <Button onClick={() => generateSuggestionsMutation.mutate()} disabled={generateSuggestionsMutation.isPending}>
                    {generateSuggestionsMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Generate Suggestions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acknowledgments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Patient Acknowledgments
                  </CardTitle>
                  <CardDescription>Record of when patients acknowledged this care plan</CardDescription>
                </div>
                <Button onClick={() => setShowAcknowledgeDialog(true)} data-testid="button-new-acknowledgment">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  New Acknowledgment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {acknowledgments?.map((ack) => (
                  <div key={ack.id} className="border rounded-lg p-4" data-testid={`acknowledgment-${ack.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{ack.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          Acknowledged via {ack.acknowledgedVia} on {formatDateTime(ack.acknowledgedAt)}
                        </p>
                        {ack.witnessName && (
                          <p className="text-sm text-muted-foreground">Witnessed by: {ack.witnessName}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Acknowledged
                      </Badge>
                    </div>
                    {ack.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">{ack.notes}</p>
                    )}
                  </div>
                ))}
                {(!acknowledgments || acknowledgments.length === 0) && (
                  <div className="text-center py-8">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Acknowledgments Yet</h3>
                    <p className="text-muted-foreground">
                      The patient has not acknowledged this care plan yet.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Care Plan</DialogTitle>
            <DialogDescription>
              Record your acknowledgment of this care plan. This confirms you have reviewed and understand the plan.
            </DialogDescription>
          </DialogHeader>
          <AcknowledgmentForm onSubmit={(data) => acknowledgeMutation.mutate(data)} isPending={acknowledgeMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const acknowledgmentSchema = z.object({
  acknowledgedVia: z.enum(["web", "mobile", "in_person", "verbal"]),
  notes: z.string().optional(),
});

function AcknowledgmentForm({ onSubmit, isPending }: { onSubmit: (data: { acknowledgedVia: string; notes?: string }) => void; isPending: boolean }) {
  const form = useForm({
    resolver: zodResolver(acknowledgmentSchema),
    defaultValues: {
      acknowledgedVia: "web" as const,
      notes: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="acknowledgedVia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Acknowledgment Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-ack-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="web">Web Portal</SelectItem>
                  <SelectItem value="mobile">Mobile App</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="verbal">Verbal</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional notes..." {...field} data-testid="input-ack-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-ack">
            {isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Acknowledge
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function CollaborativeCarePlansPage() {
  const [, params] = useRoute("/collaborative-care-plans/:id");
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {params?.id ? (
        <CarePlanDetailView carePlanId={params.id} />
      ) : (
        <CarePlansListView />
      )}
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-collaborative-care-plans-disclaimer" />
    </div>
  );
}