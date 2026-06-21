import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getStatusColor } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Map,
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Target,
  Award,
  Bell,
  SkipForward,
  ArrowLeft,
  Heart,
  Activity,
  Pill,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type {
  HealthJourneyTemplate,
  HealthJourneyInstance,
  HealthJourneyStepInstance,
  HealthJourneyStepTemplate,
  JourneyReminder,
} from "@shared/schema";

interface JourneyWithTemplate {
  journey: HealthJourneyInstance;
  template: HealthJourneyTemplate;
}

function getStepIcon(type: string) {
  switch (type) {
    case "education":
      return BookOpen;
    case "data_collection":
      return ClipboardList;
    case "check_in":
      return MessageSquare;
    case "action_item":
      return Target;
    case "milestone":
      return Award;
    case "reminder":
      return Bell;
    default:
      return Circle;
  }
}


function getCategoryIcon(category: string) {
  switch (category) {
    case "cardiovascular":
      return Heart;
    case "metabolic":
      return Activity;
    case "medication":
      return Pill;
    default:
      return Map;
  }
}

function StepDataForm({
  step,
  stepTemplate,
  onSubmit,
  isSubmitting,
}: {
  step: HealthJourneyStepInstance;
  stepTemplate?: HealthJourneyStepTemplate;
  onSubmit: (data: Record<string, string | number | boolean>) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, string | number | boolean>>({});
  const fields = stepTemplate?.dataCollection?.fields || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (name: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (fields.length === 0) {
    return (
      <Button
        onClick={() => onSubmit({})}
        disabled={isSubmitting}
        className="w-full"
        data-testid="button-complete-step"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        )}
        Mark as Complete
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(field => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
          </Label>
          
          {field.type === "text" && (
            <Input
              id={field.name}
              value={(formData[field.name] as string) || ""}
              onChange={e => updateField(field.name, e.target.value)}
              required={field.required}
              data-testid={`input-${field.name}`}
            />
          )}
          
          {field.type === "number" && (
            <Input
              id={field.name}
              type="number"
              value={(formData[field.name] as number) || ""}
              onChange={e => updateField(field.name, parseFloat(e.target.value) || 0)}
              required={field.required}
              data-testid={`input-${field.name}`}
            />
          )}
          
          {field.type === "boolean" && (
            <div className="flex items-center gap-3">
              <Switch
                id={field.name}
                checked={(formData[field.name] as boolean) || false}
                onCheckedChange={checked => updateField(field.name, checked)}
                data-testid={`switch-${field.name}`}
              />
              <span className="text-sm text-muted-foreground">
                {formData[field.name] ? "Yes" : "No"}
              </span>
            </div>
          )}
          
          {field.type === "select" && field.options && (
            <Select
              value={(formData[field.name] as string) || ""}
              onValueChange={value => updateField(field.name, value)}
            >
              <SelectTrigger data-testid={`select-${field.name}`}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {field.type === "scale" && field.options && (
            <RadioGroup
              value={(formData[field.name] as string) || ""}
              onValueChange={value => updateField(field.name, value)}
              className="flex gap-2"
            >
              {field.options.map(option => (
                <div key={option} className="flex items-center">
                  <RadioGroupItem
                    value={option}
                    id={`${field.name}-${option}`}
                    data-testid={`radio-${field.name}-${option}`}
                  />
                  <Label htmlFor={`${field.name}-${option}`} className="ml-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>
      ))}
      
      <Button type="submit" disabled={isSubmitting} className="w-full" data-testid="button-submit-step">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        )}
        Submit
      </Button>
    </form>
  );
}

function JourneyStepCard({
  step,
  stepTemplate,
  journeyId,
  isExpanded,
  onToggle,
}: {
  step: HealthJourneyStepInstance;
  stepTemplate?: HealthJourneyStepTemplate;
  journeyId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const StepIcon = getStepIcon(step.type);

  const completeStepMutation = useMutation({
    mutationFn: async (data: Record<string, string | number | boolean>) => {
      return apiRequest("POST", `/api/health-journeys/${journeyId}/steps/${step.id}/complete`, { collectedData: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys", journeyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys"] });
      toast({
        title: "Step completed",
        description: "Great progress on your health journey!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete step. Please try again.",
        variant: "destructive",
      });
    },
  });

  const skipStepMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/health-journeys/${journeyId}/steps/${step.id}/skip`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys", journeyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys"] });
    },
  });

  const isActionable = step.status === "available" || step.status === "in_progress";
  const isCompleted = step.status === "completed";
  const isSkipped = step.status === "skipped";

  return (
    <Card 
      className={`transition-all ${isActionable ? "border-primary/50" : ""}`}
      data-testid={`card-step-${step.id}`}
    >
      <CardHeader 
        className="cursor-pointer py-3" 
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              isCompleted 
                ? "bg-green-100 dark:bg-green-900" 
                : isActionable 
                  ? "bg-blue-100 dark:bg-blue-900" 
                  : "bg-muted"
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <StepIcon className={`h-4 w-4 ${isActionable ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{step.title}</CardTitle>
              <CardDescription className="text-sm">
                {stepTemplate?.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(step.status)}>
              {step.status.replace("_", " ")}
            </Badge>
            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {stepTemplate?.content?.educationText && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{stepTemplate.content.educationText}</p>
            </div>
          )}
          
          {stepTemplate?.content?.educationLinks && stepTemplate.content.educationLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Learn More:</p>
              {stepTemplate.content.educationLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid={`link-education-${idx}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {link.title}
                </a>
              ))}
            </div>
          )}

          {stepTemplate?.content?.milestoneDescription && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <p className="text-sm">{stepTemplate.content.milestoneDescription}</p>
              </div>
            </div>
          )}

          {isActionable && (
            <div className="space-y-3">
              <StepDataForm
                step={step}
                stepTemplate={stepTemplate}
                onSubmit={data => completeStepMutation.mutate(data)}
                isSubmitting={completeStepMutation.isPending}
              />
              
              {step.type !== "milestone" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => skipStepMutation.mutate()}
                  disabled={skipStepMutation.isPending}
                  className="w-full"
                  data-testid="button-skip-step"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip this step
                </Button>
              )}
            </div>
          )}

          {isCompleted && step.collectedData && Object.keys(step.collectedData).length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Your responses:</p>
              <div className="space-y-1">
                {Object.entries(step.collectedData).map(([key, value]) => (
                  <p key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}:</span> {String(value)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {step.dueAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due: {new Date(step.dueAt).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function JourneyDetail({
  journeyId,
  onBack,
}: {
  journeyId: string;
  onBack: () => void;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<JourneyWithTemplate>({
    queryKey: ["/api/health-journeys", journeyId],
  });

  const pauseJourneyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/health-journeys/${journeyId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys", journeyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys"] });
      toast({
        title: "Journey paused",
        description: "You can resume anytime.",
      });
    },
  });

  const resumeJourneyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/health-journeys/${journeyId}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys", journeyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys"] });
      toast({
        title: "Journey resumed",
        description: "Continue making progress!",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p>Journey not found</p>
          <Button variant="ghost" onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Journeys
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { journey, template } = data;
  const CategoryIcon = getCategoryIcon(template.category);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-journeys">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CategoryIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{journey.templateName}</CardTitle>
                <CardDescription className="mt-1">{template.description}</CardDescription>
              </div>
            </div>
            <Badge variant={journey.status === "active" ? "default" : "secondary"}>
              {journey.status}
            </Badge>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{journey.progressPercent}%</span>
            </div>
            <Progress value={journey.progressPercent} />
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>Started: {new Date(journey.startedAt).toLocaleDateString()}</span>
            <span>Expected: {new Date(journey.expectedCompletionAt).toLocaleDateString()}</span>
          </div>

          <div className="flex gap-2 mt-4">
            {journey.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseJourneyMutation.mutate()}
                disabled={pauseJourneyMutation.isPending}
                data-testid="button-pause-journey"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause Journey
              </Button>
            )}
            {journey.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => resumeJourneyMutation.mutate()}
                disabled={resumeJourneyMutation.isPending}
                data-testid="button-resume-journey"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Journey
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold">Journey Steps</h3>
        {journey.steps.map(step => {
          const stepTemplate = template.steps.find(s => s.id === step.templateStepId);
          return (
            <JourneyStepCard
              key={step.id}
              step={step}
              stepTemplate={stepTemplate}
              journeyId={journey.id}
              isExpanded={expandedStep === step.id}
              onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function JourneyList({ onSelectJourney }: { onSelectJourney: (id: string) => void }) {
  const { data, isLoading } = useQuery<{ journeys: HealthJourneyInstance[] }>({
    queryKey: ["/api/health-journeys"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const journeys = data?.journeys || [];
  const activeJourneys = journeys.filter(j => j.status === "active" || j.status === "paused");
  const completedJourneys = journeys.filter(j => j.status === "completed");

  if (journeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Active Journeys</h3>
          <p className="text-muted-foreground text-sm">
            Health journeys are personalized programs triggered by your health data.
            Start a journey from the available templates below.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {activeJourneys.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Active Journeys</h3>
          {activeJourneys.map(journey => (
            <Card
              key={journey.id}
              className="cursor-pointer hover-elevate transition-all"
              onClick={() => onSelectJourney(journey.id)}
              data-testid={`card-journey-${journey.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{journey.templateName}</CardTitle>
                  <Badge variant={journey.status === "active" ? "default" : "secondary"}>
                    {journey.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{journey.progressPercent}%</span>
                  </div>
                  <Progress value={journey.progressPercent} />
                  <p className="text-xs text-muted-foreground">
                    Step {journey.currentStepIndex + 1} of {journey.steps.length}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {completedJourneys.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Completed Journeys</h3>
          {completedJourneys.map(journey => (
            <Card
              key={journey.id}
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectJourney(journey.id)}
              data-testid={`card-journey-completed-${journey.id}`}
            >
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-base">{journey.templateName}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {journey.completedAt && new Date(journey.completedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateList() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ templates: HealthJourneyTemplate[] }>({
    queryKey: ["/api/health-journeys/templates"],
  });

  const { data: journeysData } = useQuery<{ journeys: HealthJourneyInstance[] }>({
    queryKey: ["/api/health-journeys"],
  });

  const startJourneyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", "/api/health-journeys/start", { templateId, triggeredBy: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys"] });
      toast({
        title: "Journey started",
        description: "Your personalized health journey has begun!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start journey. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templates = data?.templates || [];
  const activeJourneyTemplateIds = (journeysData?.journeys || [])
    .filter(j => j.status === "active" || j.status === "paused")
    .map(j => j.templateId);

  return (
    <div className="space-y-4">
      {templates.map(template => {
        const CategoryIcon = getCategoryIcon(template.category);
        const isActive = activeJourneyTemplateIds.includes(template.id);

        return (
          <Card key={template.id} data-testid={`card-template-${template.id}`}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CategoryIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="outline">{template.estimatedDurationDays} days</Badge>
                  </div>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{template.steps.length} steps</span>
                  <span className="capitalize">{template.category}</span>
                </div>
                {isActive ? (
                  <Badge variant="secondary">Already Active</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => startJourneyMutation.mutate(template.id)}
                    disabled={startJourneyMutation.isPending}
                    data-testid={`button-start-${template.id}`}
                  >
                    {startJourneyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Journey
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RemindersList() {
  const { data, isLoading } = useQuery<{ reminders: JourneyReminder[] }>({
    queryKey: ["/api/health-journeys/reminders/upcoming"],
  });

  const dismissMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return apiRequest("POST", `/api/health-journeys/reminders/${reminderId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journeys/reminders/upcoming"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const reminders = data?.reminders || [];

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No upcoming reminders</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map(reminder => (
        <Card key={reminder.id} data-testid={`card-reminder-${reminder.id}`}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{reminder.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(reminder.scheduledAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissMutation.mutate(reminder.id)}
                disabled={dismissMutation.isPending}
                data-testid={`button-dismiss-${reminder.id}`}
              >
                Dismiss
              </Button>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default function HealthJourneysPage() {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("my-journeys");

  if (selectedJourneyId) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <JourneyDetail
          journeyId={selectedJourneyId}
          onBack={() => setSelectedJourneyId(null)}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" />
          Health Journeys
        </h1>
        <p className="text-muted-foreground mt-1">
          Personalized health programs with education, tracking, and reminders
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-journeys" data-testid="tab-my-journeys">
            My Journeys
          </TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">
            Available
          </TabsTrigger>
          <TabsTrigger value="reminders" data-testid="tab-reminders">
            Reminders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-journeys" className="mt-4">
          <JourneyList onSelectJourney={setSelectedJourneyId} />
        </TabsContent>

        <TabsContent value="available" className="mt-4">
          <TemplateList />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <RemindersList />
        </TabsContent>
      </Tabs>

      <Card className="mt-6 bg-muted/50">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center">
            Health journeys provide educational content and tracking tools. 
            They do not replace professional medical advice. 
            Always consult your healthcare provider for personal health decisions.
          </p>
        </CardContent>
      </Card>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-journeys-disclaimer" />
    </div>
  );
}