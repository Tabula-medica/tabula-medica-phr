import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Target,
  ClipboardList,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
  Users,
  Clock,
  ArrowRight,
  Plus,
  Shield,
  Activity,
  Heart,
  Brain,
  Pill,
} from "lucide-react";
import type {
  AICarePlan,
  SmartGoal,
  AICarePlanIntervention,
  PatientEducationMaterial,
  FollowUpScheduleItem,
  InterventionLibraryItem,
  GoalCategory,
  InterventionCategory,
} from "@shared/schema";

type AICarePlanStatus = "draft" | "pending_review" | "approved" | "active" | "completed" | "cancelled";

const statusColors: Record<AICarePlanStatus, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-800",
  pending_review: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-800",
  approved: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800",
  completed: "bg-purple-500/10 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-800",
  cancelled: "bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-800",
};

const categoryIcons: Record<GoalCategory, typeof Heart> = {
  medication_management: Pill,
  vital_monitoring: Activity,
  lifestyle_modification: Activity,
  disease_management: Heart,
  preventive_care: Shield,
  mental_health: Brain,
  social_support: Users,
  care_coordination: ClipboardList,
};

function StatusBadge({ status }: { status: AICarePlanStatus }) {
  const labels: Record<AICarePlanStatus, string> = {
    draft: "Draft",
    pending_review: "Pending Review",
    approved: "Approved",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <Badge variant="outline" className={statusColors[status]} data-testid={`badge-status-${status}`}>
      {labels[status]}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400",
    high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400",
    low: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400",
  };
  return (
    <Badge variant="outline" className={colors[priority] || colors.medium} data-testid={`badge-priority-${priority}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function CarePlanCard({ carePlan, onView, onEdit }: {
  carePlan: AICarePlan;
  onView: () => void;
  onEdit: () => void;
}) {
  const status = carePlan.status as AICarePlanStatus;
  return (
    <Card className="hover-elevate" data-testid={`card-care-plan-${carePlan.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate" data-testid={`text-plan-title-${carePlan.id}`}>
              Care Plan: {carePlan.patientName}
            </CardTitle>
            <CardDescription className="text-xs" data-testid={`text-plan-patient-${carePlan.id}`}>
              Patient ID: {carePlan.patientId} | Created: {format(new Date(carePlan.generatedAt), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-plan-summary-${carePlan.id}`}>
          {carePlan.summary}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            <span>{carePlan.smartGoals.length} Goals</span>
          </div>
          <div className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            <span>{carePlan.interventions.length} Interventions</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span>{carePlan.confidenceScore}% AI Confidence</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onView} data-testid={`button-view-plan-${carePlan.id}`}>
            <Eye className="mr-1 h-3 w-3" />
            View
          </Button>
          {(status === "draft" || status === "pending_review") && (
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-plan-${carePlan.id}`}>
              <Edit3 className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SmartGoalSection({ goals }: { goals: SmartGoal[] }) {
  if (goals.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Target className="h-4 w-4" />
        SMART Goals ({goals.length})
      </h4>
      <Accordion type="multiple" className="space-y-2">
        {goals.map((goal) => {
          const CategoryIcon = categoryIcons[goal.category] || Target;
          return (
            <AccordionItem key={goal.id} value={goal.id} className="border rounded-md px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1">
                  <CategoryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-goal-title-${goal.id}`}>
                      {goal.specific}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {goal.category.replace(/_/g, " ")}
                      </Badge>
                      <Progress value={goal.progress} className="h-1.5 w-16" />
                      <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="grid gap-2 text-sm pl-7">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Specific:</span>
                      <p>{goal.specific}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Measurable:</span>
                      <p>{goal.measurable}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Achievable:</span>
                      <p>{goal.achievable}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Relevant:</span>
                      <p>{goal.relevant}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Time-bound:</span>
                      <p>{goal.timeBound}</p>
                    </div>
                  </div>
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="mt-2">
                      <span className="text-muted-foreground">Milestones:</span>
                      <ul className="mt-1 space-y-1">
                        {goal.milestones.map((m) => (
                          <li key={m.id} className="flex items-center gap-2">
                            {m.completed ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={m.completed ? "line-through text-muted-foreground" : ""}>
                              {m.description}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              by {format(new Date(m.targetDate), "MMM d")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function InterventionSection({ interventions }: { interventions: AICarePlanIntervention[] }) {
  if (interventions.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <ClipboardList className="h-4 w-4" />
        Interventions ({interventions.length})
      </h4>
      <div className="space-y-2">
        {interventions.map((intervention) => (
          <Card key={intervention.id} className="p-3" data-testid={`card-intervention-${intervention.id}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm" data-testid={`text-intervention-title-${intervention.id}`}>
                    {intervention.title}
                  </p>
                  <PriorityBadge priority={intervention.priority} />
                  {intervention.isFromLibrary && (
                    <Badge variant="secondary" className="text-xs">
                      <BookOpen className="mr-1 h-2 w-2" />
                      From Library
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{intervention.description}</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">Rationale:</span> {intervention.rationale}
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Assigned: {intervention.responsibleParty}</span>
              {intervention.frequency && <span>Frequency: {intervention.frequency}</span>}
              <Badge variant="outline" className="text-xs">
                {intervention.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EducationMaterialsSection({ materials }: { materials: PatientEducationMaterial[] }) {
  if (materials.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        Patient Education Materials ({materials.length})
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {materials.map((material) => (
          <Card key={material.id} className="p-3 hover-elevate" data-testid={`card-education-${material.id}`}>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{material.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{material.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">{material.type}</Badge>
                  <Badge variant="outline" className="text-xs">{material.readingLevel}</Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FollowUpSection({ schedule }: { schedule: FollowUpScheduleItem[] }) {
  if (schedule.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Follow-up Schedule ({schedule.length})
      </h4>
      <div className="space-y-2">
        {schedule.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50" data-testid={`item-followup-${item.id}`}>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.type} | Scheduled: {format(new Date(item.scheduledDate), "MMM d, yyyy")}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{item.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarePlanDetailDialog({ carePlan, open, onOpenChange }: {
  carePlan: AICarePlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_changes" | null>(null);
  const [reviewComments, setReviewComments] = useState("");
  const status = carePlan.status as AICarePlanStatus;

  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/ai-personalized-care-plans/${carePlan.id}/submit-for-review`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-personalized-care-plans"] });
      toast({ title: "Success", description: "Care plan submitted for review" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit care plan for review", variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { action: string; comments?: string }) => {
      return await apiRequest("POST", `/api/ai-personalized-care-plans/${carePlan.id}/review`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-personalized-care-plans"] });
      setReviewAction(null);
      setReviewComments("");
      toast({ title: "Success", description: "Care plan review completed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to review care plan", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/ai-personalized-care-plans/${carePlan.id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-personalized-care-plans"] });
      toast({ title: "Success", description: "Care plan activated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to activate care plan", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-care-plan">
                <Sparkles className="h-5 w-5 text-primary" />
                Care Plan: {carePlan.patientName}
              </DialogTitle>
              <DialogDescription>
                AI-generated care plan with {carePlan.confidenceScore}% confidence
              </DialogDescription>
            </div>
            <StatusBadge status={status} />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{carePlan.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {carePlan.primaryGoals.map((goal, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <SmartGoalSection goals={carePlan.smartGoals} />
            
            <Separator />
            
            <InterventionSection interventions={carePlan.interventions} />
            
            <Separator />
            
            <EducationMaterialsSection materials={carePlan.educationMaterials} />
            
            <Separator />
            
            <FollowUpSection schedule={carePlan.followUpSchedule} />

            {carePlan.reviewHistory && carePlan.reviewHistory.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Review History
                  </h4>
                  <div className="space-y-2">
                    {carePlan.reviewHistory.map((review, i) => (
                      <div key={i} className="p-2 rounded-md bg-muted/50 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{review.reviewerName}</span>
                          <Badge variant="outline" className="text-xs">{review.action}</Badge>
                        </div>
                        {review.comments && (
                          <p className="text-muted-foreground mt-1">{review.comments}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(review.timestamp), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          {status === "draft" && (
            <Button
              onClick={() => submitForReviewMutation.mutate()}
              disabled={submitForReviewMutation.isPending}
              data-testid="button-submit-for-review"
            >
              {submitForReviewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit for Review
            </Button>
          )}
          
          {status === "pending_review" && (
            <>
              <Button
                variant="outline"
                onClick={() => setReviewAction("request_changes")}
                data-testid="button-request-changes"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Request Changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => setReviewAction("reject")}
                data-testid="button-reject"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => setReviewAction("approve")}
                data-testid="button-approve"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}
          
          {status === "approved" && (
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              data-testid="button-activate"
            >
              {activateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Activate Care Plan
            </Button>
          )}
        </DialogFooter>

        {reviewAction && (
          <Dialog open={!!reviewAction} onOpenChange={() => setReviewAction(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {reviewAction === "approve" && "Approve Care Plan"}
                  {reviewAction === "reject" && "Reject Care Plan"}
                  {reviewAction === "request_changes" && "Request Changes"}
                </DialogTitle>
                <DialogDescription>
                  Add any comments or notes for this review action.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="review-comments">Comments</Label>
                  <Textarea
                    id="review-comments"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Enter your review comments..."
                    rows={4}
                    data-testid="textarea-review-comments"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewAction(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => reviewMutation.mutate({ action: reviewAction, comments: reviewComments })}
                  disabled={reviewMutation.isPending}
                  variant={reviewAction === "reject" ? "destructive" : "default"}
                  data-testid="button-confirm-review"
                >
                  {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GenerateCarePlanDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState("");
  const [focusAreas, setFocusAreas] = useState<GoalCategory[]>([]);
  const [timeframe, setTimeframe] = useState<"short_term" | "medium_term" | "long_term">("medium_term");
  const [complexityLevel, setComplexityLevel] = useState<"simple" | "moderate" | "comprehensive">("moderate");
  const [patientPreferences, setPatientPreferences] = useState("");
  const [caregiverInvolvement, setCaregiverInvolvement] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai-personalized-care-plans/generate", {
        patientId,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
        timeframe,
        complexityLevel,
        patientPreferences: patientPreferences || undefined,
        caregiverInvolvement,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-personalized-care-plans"] });
      onOpenChange(false);
      setPatientId("");
      setFocusAreas([]);
      setPatientPreferences("");
      toast({ title: "Success", description: "AI care plan generated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate care plan", variant: "destructive" });
    },
  });

  const allCategories: GoalCategory[] = [
    "medication_management",
    "vital_monitoring",
    "lifestyle_modification",
    "disease_management",
    "preventive_care",
    "mental_health",
    "social_support",
    "care_coordination",
  ];

  const toggleFocusArea = (category: GoalCategory) => {
    setFocusAreas(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate AI Care Plan
          </DialogTitle>
          <DialogDescription>
            Create a personalized care plan using AI-powered recommendations based on patient data and evidence-based guidelines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient-id">Patient ID</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger id="patient-id" data-testid="select-patient-id">
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patient-001">Patient 001 - John Doe</SelectItem>
                <SelectItem value="patient-002">Patient 002 - Jane Smith</SelectItem>
                <SelectItem value="patient-003">Patient 003 - Robert Johnson</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldCaption>Focus Areas (optional)</FieldCaption>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((category) => {
                const Icon = categoryIcons[category];
                const isSelected = focusAreas.includes(category);
                return (
                  <Button
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFocusArea(category)}
                    className="text-xs"
                    data-testid={`button-focus-${category}`}
                  >
                    <Icon className="mr-1 h-3 w-3" />
                    {category.replace(/_/g, " ")}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai-personalized-care-pla-timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
                <SelectTrigger id="ai-personalized-care-pla-timeframe" data-testid="select-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short-term (1-3 months)</SelectItem>
                  <SelectItem value="medium_term">Medium-term (3-6 months)</SelectItem>
                  <SelectItem value="long_term">Long-term (6+ months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-personalized-care-pla-complexity">Complexity</Label>
              <Select value={complexityLevel} onValueChange={(v) => setComplexityLevel(v as typeof complexityLevel)}>
                <SelectTrigger id="ai-personalized-care-pla-complexity" data-testid="select-complexity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferences">Patient Preferences (optional)</Label>
            <Textarea
              id="preferences"
              value={patientPreferences}
              onChange={(e) => setPatientPreferences(e.target.value)}
              placeholder="Any specific patient preferences or considerations..."
              rows={3}
              data-testid="textarea-preferences"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="caregiver"
              checked={caregiverInvolvement}
              onChange={(e) => setCaregiverInvolvement(e.target.checked)}
              className="h-4 w-4 rounded border-input"
              data-testid="checkbox-caregiver"
            />
            <Label htmlFor="caregiver" className="text-sm font-normal">
              Include caregiver involvement recommendations
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!patientId || generateMutation.isPending}
            data-testid="button-generate-plan"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Care Plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AIPersonalizedCarePlansPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AICarePlanStatus | "all">("all");
  const [selectedPlan, setSelectedPlan] = useState<AICarePlan | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const { data: carePlans, isLoading, error } = useQuery<AICarePlan[]>({
    queryKey: ["/api/ai-personalized-care-plans"],
    queryFn: async () => {
      const response = await fetch("/api/ai-personalized-care-plans");
      if (!response.ok) throw new Error("Failed to fetch care plans");
      return response.json();
    },
  });

  const filteredPlans = carePlans?.filter(plan => 
    activeTab === "all" || (plan.status as AICarePlanStatus) === activeTab
  ) || [];

  const statusCounts = {
    all: carePlans?.length || 0,
    draft: carePlans?.filter(p => (p.status as AICarePlanStatus) === "draft").length || 0,
    pending_review: carePlans?.filter(p => (p.status as AICarePlanStatus) === "pending_review").length || 0,
    approved: carePlans?.filter(p => (p.status as AICarePlanStatus) === "approved").length || 0,
    active: carePlans?.filter(p => (p.status as AICarePlanStatus) === "active").length || 0,
    completed: carePlans?.filter(p => (p.status as AICarePlanStatus) === "completed").length || 0,
    cancelled: carePlans?.filter(p => (p.status as AICarePlanStatus) === "cancelled").length || 0,
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load care plans. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-page-title">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Personalized Care Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate, review, and manage AI-powered personalized care plans for patients
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-new-care-plan">
          <Plus className="mr-2 h-4 w-4" />
          Generate New Care Plan
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-1">
          <TabsTrigger value="all" data-testid="tab-all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-draft">
            Draft ({statusCounts.draft})
          </TabsTrigger>
          <TabsTrigger value="pending_review" data-testid="tab-pending">
            Pending ({statusCounts.pending_review})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({statusCounts.approved})
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({statusCounts.active})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({statusCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">
            Cancelled ({statusCounts.cancelled})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No care plans found</h3>
                <p className="text-muted-foreground mt-1">
                  {activeTab === "all" 
                    ? "Generate your first AI care plan to get started."
                    : `No care plans with status "${activeTab.replace("_", " ")}".`}
                </p>
                {activeTab === "all" && (
                  <Button className="mt-4" onClick={() => setShowGenerateDialog(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Care Plan
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => (
                <CarePlanCard
                  key={plan.id}
                  carePlan={plan}
                  onView={() => setSelectedPlan(plan)}
                  onEdit={() => setSelectedPlan(plan)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedPlan && (
        <CarePlanDetailDialog
          carePlan={selectedPlan}
          open={!!selectedPlan}
          onOpenChange={(open) => !open && setSelectedPlan(null)}
        />
      )}

      <GenerateCarePlanDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
      />

      <Card className="p-4 bg-amber-500/10 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Provider Review Required
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              All AI-generated care plans require review and approval by a qualified healthcare provider before activation. 
              The AI recommendations are suggestions based on clinical guidelines and should be evaluated in the context of each patient's individual circumstances.
            </p>
          </div>
        </div>
      </Card>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-ai-personalized-care-plans-disclaimer" />
    </div>
  );
}