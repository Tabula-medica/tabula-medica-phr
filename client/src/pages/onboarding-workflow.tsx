import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  UserPlus,
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  SkipForward,
  Users,
  BarChart3,
} from "lucide-react";
import type {
  PatientOnboardingWorkflow,
  PatientOnboardingStep,
  PatientOnboardingStepType,
} from "@shared/schema";

const stepLabels: Record<PatientOnboardingStepType, string> = {
  welcome: "Welcome",
  identity_verification: "Identity Verification",
  demographics: "Demographics",
  insurance: "Insurance",
  medical_history: "Medical History",
  ehr_connection: "EHR Connection",
  consent: "Consent",
  emergency_contact: "Emergency Contact",
  care_preferences: "Care Preferences",
  complete: "Complete",
};

const stepDescriptions: Record<PatientOnboardingStepType, string> = {
  welcome: "Introduction to Tabula Medica",
  identity_verification: "Verify your identity",
  demographics: "Basic personal information",
  insurance: "Insurance coverage details",
  medical_history: "Past medical history",
  ehr_connection: "Connect to your health records",
  consent: "Privacy and data sharing consents",
  emergency_contact: "Emergency contact information",
  care_preferences: "Communication and care preferences",
  complete: "Onboarding complete",
};

interface MetricsResponse {
  metrics: {
    totalWorkflows: number;
    completedWorkflows: number;
    inProgressWorkflows: number;
    pendingWorkflows: number;
    completionRate: number;
    averageStepsCompleted: number;
    byStep: Record<string, { completed: number; skipped: number; pending: number }>;
  };
}

interface WorkflowListResponse {
  workflows: PatientOnboardingWorkflow[];
}

interface WorkflowResponse {
  workflow: PatientOnboardingWorkflow;
  step?: PatientOnboardingStep;
}

export default function OnboardingWorkflow() {
  const { toast } = useToast();
  const [selectedWorkflow, setSelectedWorkflow] = useState<PatientOnboardingWorkflow | null>(null);
  const [newPatientId, setNewPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");

  const workflowsQuery = useQuery<WorkflowListResponse>({
    queryKey: ["/api/patient-onboarding/workflows"],
  });

  const metricsQuery = useQuery<MetricsResponse>({
    queryKey: ["/api/patient-onboarding/metrics"],
  });

  const startWorkflowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-onboarding/start", {
        patientId: newPatientId,
        patientName: newPatientName,
      });
      return response.json();
    },
    onSuccess: (data: WorkflowResponse) => {
      toast({ title: "Success", description: "Patient onboarding started" });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-onboarding/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-onboarding/metrics"] });
      setSelectedWorkflow(data.workflow);
      setNewPatientId("");
      setNewPatientName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start onboarding", variant: "destructive" });
    },
  });

  const submitStepMutation = useMutation({
    mutationFn: async (params: { workflowId: string; stepType: PatientOnboardingStepType; data?: Record<string, unknown>; skip?: boolean }) => {
      const response = await apiRequest("POST", "/api/patient-onboarding/submit-step", params);
      return response.json();
    },
    onSuccess: (data: WorkflowResponse) => {
      toast({ title: "Success", description: "Step completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-onboarding/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-onboarding/metrics"] });
      setSelectedWorkflow(data.workflow);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit step", variant: "destructive" });
    },
  });

  const handleStartWorkflow = () => {
    if (!newPatientId) {
      toast({ title: "Error", description: "Patient ID is required", variant: "destructive" });
      return;
    }
    startWorkflowMutation.mutate();
  };

  const handleSubmitStep = (stepType: PatientOnboardingStepType, skip = false) => {
    if (!selectedWorkflow) return;
    submitStepMutation.mutate({
      workflowId: selectedWorkflow.id,
      stepType,
      skip,
      data: { submitted: true },
    });
  };

  const getStepIcon = (step: PatientOnboardingStep) => {
    if (step.status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (step.status === "skipped") return <SkipForward className="h-5 w-5 text-muted-foreground" />;
    if (step.status === "in_progress") return <Clock className="h-5 w-5 text-yellow-500" />;
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">In Progress</Badge>;
      case "pending":
      case "not_started":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateProgress = (workflow: PatientOnboardingWorkflow): number => {
    const completedSteps = workflow.steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
    return Math.round((completedSteps / workflow.steps.length) * 100);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Patient Onboarding Workflow</h1>
          <p className="text-muted-foreground">Streamlined 10-step FHIR-compatible registration</p>
        </div>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList data-testid="tabs-main">
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <ClipboardList className="h-4 w-4 mr-2" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-new">
            <UserPlus className="h-4 w-4 mr-2" />
            New Patient
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Active Workflows</CardTitle>
                <CardDescription>Select a workflow to view details</CardDescription>
              </CardHeader>
              <CardContent>
                {workflowsQuery.isLoading ? (
                  <p className="text-muted-foreground">Loading workflows...</p>
                ) : workflowsQuery.data?.workflows && workflowsQuery.data.workflows.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {workflowsQuery.data.workflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                            selectedWorkflow?.id === workflow.id ? "border-primary bg-accent" : ""
                          }`}
                          onClick={() => setSelectedWorkflow(workflow)}
                          data-testid={`card-workflow-${workflow.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{workflow.patientId}</span>
                            {getStatusBadge(workflow.overallStatus)}
                          </div>
                          <Progress value={calculateProgress(workflow)} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {calculateProgress(workflow)}% complete
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No workflows found.</p>
                    <p className="text-sm text-muted-foreground">Start a new patient onboarding.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Workflow Steps</CardTitle>
                <CardDescription>
                  {selectedWorkflow
                    ? `Onboarding progress for ${selectedWorkflow.patientId}`
                    : "Select a workflow to view steps"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedWorkflow ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Workflow ID: {selectedWorkflow.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Started: {new Date(selectedWorkflow.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Progress value={calculateProgress(selectedWorkflow)} className="w-32 h-3" />
                    </div>

                    <Separator />

                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {selectedWorkflow.steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            data-testid={`step-${step.stepType}`}
                          >
                            <div className="flex items-center gap-3">
                              {getStepIcon(step)}
                              <div>
                                <p className="font-medium">
                                  {index + 1}. {stepLabels[step.stepType]}
                                </p>
                                <p className="text-sm text-muted-foreground">{stepDescriptions[step.stepType]}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(step.status === "not_started" || step.status === "in_progress") ? (
                                <>
                                  {!step.isRequired && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSubmitStep(step.stepType, true)}
                                      disabled={submitStepMutation.isPending}
                                      data-testid={`button-skip-${step.stepType}`}
                                    >
                                      <SkipForward className="h-4 w-4 mr-1" />
                                      Skip
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitStep(step.stepType)}
                                    disabled={submitStepMutation.isPending}
                                    data-testid={`button-complete-${step.stepType}`}
                                  >
                                    Complete
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                  </Button>
                                </>
                              ) : (
                                getStatusBadge(step.status)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a workflow from the list to view its steps.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Workflows</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-total-workflows">
                  {metricsQuery.data?.metrics.totalWorkflows ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl text-green-600" data-testid="text-completed-workflows">
                  {metricsQuery.data?.metrics.completedWorkflows ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>In Progress</CardDescription>
                <CardTitle className="text-3xl text-yellow-600" data-testid="text-inprogress-workflows">
                  {metricsQuery.data?.metrics.inProgressWorkflows ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Completion Rate</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-completion-rate">
                  {Math.round(metricsQuery.data?.metrics.completionRate ?? 0)}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Step Completion Breakdown</CardTitle>
              <CardDescription>Completion status for each onboarding step</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsQuery.data?.metrics.byStep ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(metricsQuery.data.metrics.byStep).map(([step, counts]) => (
                      <TableRow key={step} data-testid={`row-metric-${step}`}>
                        <TableCell className="font-medium">{stepLabels[step as PatientOnboardingStepType]}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {counts.completed}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{counts.skipped}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{counts.pending}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No metrics available yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle>Start New Patient Onboarding</CardTitle>
              <CardDescription>Begin the 10-step onboarding workflow for a new patient</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patient-id">Patient ID</Label>
                <Input
                  id="patient-id"
                  placeholder="e.g., patient-001"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  data-testid="input-new-patient-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patient-name">Patient Name (optional)</Label>
                <Input
                  id="patient-name"
                  placeholder="e.g., John Smith"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  data-testid="input-new-patient-name"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleStartWorkflow}
                disabled={startWorkflowMutation.isPending || !newPatientId}
                data-testid="button-start-onboarding"
              >
                {startWorkflowMutation.isPending ? "Starting..." : "Start Onboarding"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
