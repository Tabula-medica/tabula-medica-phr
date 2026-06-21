import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Target,
  Pill,
  BookOpen,
  Activity,
  Plus,
  Check,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  Eye,
  Edit,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  User,
  Users,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface CarePlan {
  id: string;
  profileId: string;
  patientName?: string;
  title: string;
  category: string;
  status: string;
  priorityLevel: string;
  notes: string | null;
  startDate: string;
  targetEndDate: string | null;
  reviewDate: string | null;
  createdBy: string;
  lastUpdatedBy: string;
  patientAcknowledged: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface GoalLink {
  id: string;
  carePlanId: string;
  healthGoalId: string;
  priority: number;
  providerNotes: string | null;
  createdAt: string;
  goalTitle?: string;
  goalType?: string;
  targetValue?: number;
  currentValue?: number;
}

interface MedicationLink {
  id: string;
  carePlanId: string;
  medicationReminderId: string;
  dosageInstructions: string | null;
  adherenceTarget: number | null;
  createdAt: string;
  medicationName?: string;
  dosage?: string;
  frequency?: string;
}

interface EducationLink {
  id: string;
  carePlanId: string;
  contentType: string;
  title: string;
  description: string | null;
  url: string | null;
  priority: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

interface MonitoringParam {
  id: string;
  carePlanId: string;
  vitalType: string;
  frequency: string;
  targetMin: number | null;
  targetMax: number | null;
  alertOnDeviation: boolean;
  createdAt: string;
}

interface ProgressNote {
  id: string;
  carePlanId: string;
  authorId: string;
  authorRole: string;
  noteType: string;
  content: string;
  isPatientVisible: boolean;
  createdAt: string;
}

interface CarePlanDetail extends CarePlan {
  goalLinks: GoalLink[];
  medicationLinks: MedicationLink[];
  educationLinks: EducationLink[];
  monitoringParams: MonitoringParam[];
  progressNotes: ProgressNote[];
  progress: { overallProgress: number; goalsProgress: number; educationProgress: number };
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  active: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  on_hold: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  completed: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  cancelled: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
};

const priorityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 dark:bg-orange-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
  routine: "bg-muted text-muted-foreground",
};

const categoryLabels: Record<string, string> = {
  chronic_disease: "Chronic Disease",
  post_surgical: "Post-Surgical",
  preventive: "Preventive",
  mental_health: "Mental Health",
  rehabilitation: "Rehabilitation",
  palliative: "Palliative",
  wellness: "Wellness",
  medication_management: "Medication Management",
  other: "Other",
};

const NO_CDS_DISCLAIMER = "This care plan is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider before making any changes to your treatment.";

interface ComprehensiveCarePlanCardProps {
  isProvider?: boolean;
}

export function ComprehensiveCarePlanCard({ isProvider = false }: ComprehensiveCarePlanCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCarePlan, setSelectedCarePlan] = useState<CarePlanDetail | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showAddEducationDialog, setShowAddEducationDialog] = useState(false);
  const [showAddMonitoringDialog, setShowAddMonitoringDialog] = useState(false);
  
  const [newCarePlan, setNewCarePlan] = useState({
    profileId: "",
    title: "",
    category: "chronic_disease",
    priority: "medium",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    reviewDate: "",
  });

  const [newNote, setNewNote] = useState({
    noteType: "progress",
    content: "",
    isPatientVisible: true,
  });

  const [newEducation, setNewEducation] = useState({
    contentType: "article",
    title: "",
    description: "",
    priority: "medium",
  });

  const [newMonitoring, setNewMonitoring] = useState({
    parameterType: "blood_pressure",
    targetMin: "",
    targetMax: "",
    frequency: "daily",
    alertThreshold: "",
  });

  const basePath = "/api/comprehensive-care-plans";
  const listEndpoint = isProvider ? `${basePath}/care-plans` : `${basePath}/patient/care-plans`;

  const { data: carePlansData, isLoading: carePlansLoading, refetch: refetchCarePlans } = useQuery<{
    success: boolean;
    carePlans: CarePlan[];
    disclaimer: string;
  }>({
    queryKey: [listEndpoint],
  });

  const { data: carePlanDetailData, isLoading: detailLoading, refetch: refetchDetail } = useQuery<{
    success: boolean;
    carePlan: CarePlanDetail;
    disclaimer: string;
  }>({
    queryKey: [listEndpoint, selectedCarePlan?.id],
    enabled: !!selectedCarePlan?.id,
    queryFn: async () => {
      const res = await fetch(`${listEndpoint}/${selectedCarePlan!.id}`);
      return res.json();
    },
  });

  const createCarePlanMutation = useMutation({
    mutationFn: async (data: typeof newCarePlan) => {
      return apiRequest("POST", `${basePath}/care-plans`, {
        ...data,
        priorityLevel: data.priority,
        startDate: data.startDate,
        targetEndDate: data.endDate || null,
        notes: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listEndpoint] });
      setShowCreateDialog(false);
      setNewCarePlan({
        profileId: "",
        title: "",
        category: "chronic_disease",
        priority: "medium",
        description: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        reviewDate: "",
      });
      toast({ title: "Care plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create care plan", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `${basePath}/care-plans/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listEndpoint] });
      refetchDetail();
      toast({ title: "Status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const addProgressNoteMutation = useMutation({
    mutationFn: async (data: typeof newNote) => {
      const notePath = isProvider 
        ? `${basePath}/care-plans/${selectedCarePlan!.id}/progress-notes`
        : `${basePath}/patient/care-plans/${selectedCarePlan!.id}/progress-notes`;
      return apiRequest("POST", notePath, data);
    },
    onSuccess: () => {
      refetchDetail();
      setShowAddNoteDialog(false);
      setNewNote({ noteType: "progress", content: "", isPatientVisible: true });
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const acknowledgeCarePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `${basePath}/patient/care-plans/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listEndpoint] });
      refetchDetail();
      toast({ title: "Care plan acknowledged" });
    },
    onError: () => {
      toast({ title: "Failed to acknowledge care plan", variant: "destructive" });
    },
  });

  const addEducationMutation = useMutation({
    mutationFn: async (data: typeof newEducation) => {
      return apiRequest("POST", `${basePath}/care-plans/${selectedCarePlan!.id}/education`, {
        ...data,
        priority: data.priority === "high" ? 3 : data.priority === "medium" ? 2 : 1,
      });
    },
    onSuccess: () => {
      refetchDetail();
      setShowAddEducationDialog(false);
      setNewEducation({ contentType: "article", title: "", description: "", priority: "medium" });
      toast({ title: "Educational content added" });
    },
    onError: () => {
      toast({ title: "Failed to add educational content", variant: "destructive" });
    },
  });

  const completeEducationMutation = useMutation({
    mutationFn: async (educationId: string) => {
      return apiRequest("PATCH", `${basePath}/patient/education/${educationId}/complete`);
    },
    onSuccess: () => {
      refetchDetail();
      toast({ title: "Education marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to mark education complete", variant: "destructive" });
    },
  });

  const addMonitoringMutation = useMutation({
    mutationFn: async (data: typeof newMonitoring) => {
      return apiRequest("POST", `${basePath}/care-plans/${selectedCarePlan!.id}/monitoring`, {
        vitalType: data.parameterType,
        frequency: data.frequency,
        targetMin: data.targetMin ? parseFloat(data.targetMin) : null,
        targetMax: data.targetMax ? parseFloat(data.targetMax) : null,
        alertOnDeviation: !!data.alertThreshold,
      });
    },
    onSuccess: () => {
      refetchDetail();
      setShowAddMonitoringDialog(false);
      setNewMonitoring({
        parameterType: "blood_pressure",
        targetMin: "",
        targetMax: "",
        frequency: "daily",
        alertThreshold: "",
      });
      toast({ title: "Monitoring parameter added" });
    },
    onError: () => {
      toast({ title: "Failed to add monitoring parameter", variant: "destructive" });
    },
  });

  const carePlans = carePlansData?.carePlans || [];
  const detail = carePlanDetailData?.carePlan || selectedCarePlan;

  if (carePlansLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Comprehensive Care Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            <div>
              <CardTitle>Comprehensive Care Plans</CardTitle>
              <CardDescription>
                {isProvider ? "Manage patient care plans, goals, medications, and monitoring" : "View your personalized care plans and track progress"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchCarePlans()} data-testid="button-refresh-care-plans">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isProvider && (
              <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-care-plan">
                <Plus className="h-4 w-4 mr-1" />
                New Care Plan
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{NO_CDS_DISCLAIMER}</p>
          </div>
        </div>

        {selectedCarePlan ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCarePlan(null)} data-testid="button-back-to-list">
              &larr; Back to Care Plans
            </Button>
            
            <CarePlanDetailView
              carePlan={detail as CarePlanDetail}
              isProvider={isProvider}
              isLoading={detailLoading}
              onUpdateStatus={(status, notes) => updateStatusMutation.mutate({ id: selectedCarePlan.id, status, notes })}
              onAcknowledge={() => acknowledgeCarePlanMutation.mutate(selectedCarePlan.id)}
              onAddNote={() => setShowAddNoteDialog(true)}
              onAddEducation={() => setShowAddEducationDialog(true)}
              onAddMonitoring={() => setShowAddMonitoringDialog(true)}
              onCompleteEducation={(id) => completeEducationMutation.mutate(id)}
              isPending={updateStatusMutation.isPending || acknowledgeCarePlanMutation.isPending}
            />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all-plans">All Plans</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <CarePlanOverview carePlans={carePlans} onSelectPlan={(plan) => setSelectedCarePlan(plan as unknown as CarePlanDetail)} />
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <CarePlanList carePlans={carePlans} onSelectPlan={(plan) => setSelectedCarePlan(plan as unknown as CarePlanDetail)} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Care Plan</DialogTitle>
            <DialogDescription>Create a comprehensive care plan for a patient</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="profileId">Patient Profile ID</Label>
              <Input
                id="profileId"
                value={newCarePlan.profileId}
                onChange={(e) => setNewCarePlan({ ...newCarePlan, profileId: e.target.value })}
                placeholder="Enter patient profile ID"
                data-testid="input-patient-profile-id"
              />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newCarePlan.title}
                onChange={(e) => setNewCarePlan({ ...newCarePlan, title: e.target.value })}
                placeholder="e.g., Diabetes Management Plan"
                data-testid="input-care-plan-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newCarePlan.category} onValueChange={(v) => setNewCarePlan({ ...newCarePlan, category: v })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={newCarePlan.priority} onValueChange={(v) => setNewCarePlan({ ...newCarePlan, priority: v })}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newCarePlan.description}
                onChange={(e) => setNewCarePlan({ ...newCarePlan, description: e.target.value })}
                placeholder="Describe the care plan objectives..."
                data-testid="textarea-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newCarePlan.startDate}
                  onChange={(e) => setNewCarePlan({ ...newCarePlan, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newCarePlan.endDate}
                  onChange={(e) => setNewCarePlan({ ...newCarePlan, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
              <div>
                <Label htmlFor="reviewDate">Review Date</Label>
                <Input
                  id="reviewDate"
                  type="date"
                  value={newCarePlan.reviewDate}
                  onChange={(e) => setNewCarePlan({ ...newCarePlan, reviewDate: e.target.value })}
                  data-testid="input-review-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createCarePlanMutation.mutate(newCarePlan)}
              disabled={!newCarePlan.profileId || !newCarePlan.title || createCarePlanMutation.isPending}
              data-testid="button-submit-care-plan"
            >
              {createCarePlanMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Create Care Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Progress Note</DialogTitle>
            <DialogDescription>Add a note about your care plan progress</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="noteType">Note Type</Label>
              <Select value={newNote.noteType} onValueChange={(v) => setNewNote({ ...newNote, noteType: v })}>
                <SelectTrigger data-testid="select-note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="progress">Progress Update</SelectItem>
                  <SelectItem value="barrier">Barrier/Challenge</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="general">General Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="noteContent">Content</Label>
              <Textarea
                id="noteContent"
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Describe your progress or concerns..."
                rows={4}
                data-testid="textarea-note-content"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isPatientVisible"
                checked={newNote.isPatientVisible}
                onCheckedChange={(v) => setNewNote({ ...newNote, isPatientVisible: v })}
              />
              <Label htmlFor="isPatientVisible">Visible to care team</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addProgressNoteMutation.mutate(newNote)}
              disabled={!newNote.content || addProgressNoteMutation.isPending}
              data-testid="button-submit-note"
            >
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEducationDialog} onOpenChange={setShowAddEducationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Educational Content</DialogTitle>
            <DialogDescription>Assign educational materials to this care plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contentType">Content Type</Label>
              <Select value={newEducation.contentType} onValueChange={(v) => setNewEducation({ ...newEducation, contentType: v })}>
                <SelectTrigger data-testid="select-content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="eduTitle">Title</Label>
              <Input
                id="eduTitle"
                value={newEducation.title}
                onChange={(e) => setNewEducation({ ...newEducation, title: e.target.value })}
                placeholder="e.g., Understanding Blood Sugar Levels"
                data-testid="input-edu-title"
              />
            </div>
            <div>
              <Label htmlFor="eduDescription">Description</Label>
              <Textarea
                id="eduDescription"
                value={newEducation.description}
                onChange={(e) => setNewEducation({ ...newEducation, description: e.target.value })}
                placeholder="Brief description of the educational content..."
                data-testid="textarea-edu-description"
              />
            </div>
            <div>
              <Label htmlFor="eduPriority">Priority</Label>
              <Select value={newEducation.priority} onValueChange={(v) => setNewEducation({ ...newEducation, priority: v })}>
                <SelectTrigger data-testid="select-edu-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEducationDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addEducationMutation.mutate(newEducation)}
              disabled={!newEducation.title || addEducationMutation.isPending}
              data-testid="button-submit-education"
            >
              Add Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMonitoringDialog} onOpenChange={setShowAddMonitoringDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Monitoring Parameter</DialogTitle>
            <DialogDescription>Set up remote monitoring parameters for this care plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="parameterType">Parameter Type</Label>
              <Select value={newMonitoring.parameterType} onValueChange={(v) => setNewMonitoring({ ...newMonitoring, parameterType: v })}>
                <SelectTrigger data-testid="select-parameter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                  <SelectItem value="heart_rate">Heart Rate</SelectItem>
                  <SelectItem value="blood_glucose">Blood Glucose</SelectItem>
                  <SelectItem value="weight">Weight</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="o2_saturation">O2 Saturation</SelectItem>
                  <SelectItem value="respiratory_rate">Respiratory Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="targetMin">Target Min</Label>
                <Input
                  id="targetMin"
                  type="number"
                  value={newMonitoring.targetMin}
                  onChange={(e) => setNewMonitoring({ ...newMonitoring, targetMin: e.target.value })}
                  placeholder="e.g., 70"
                  data-testid="input-target-min"
                />
              </div>
              <div>
                <Label htmlFor="targetMax">Target Max</Label>
                <Input
                  id="targetMax"
                  type="number"
                  value={newMonitoring.targetMax}
                  onChange={(e) => setNewMonitoring({ ...newMonitoring, targetMax: e.target.value })}
                  placeholder="e.g., 140"
                  data-testid="input-target-max"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="frequency">Monitoring Frequency</Label>
              <Select value={newMonitoring.frequency} onValueChange={(v) => setNewMonitoring({ ...newMonitoring, frequency: v })}>
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="twice_daily">Twice Daily</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="as_needed">As Needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="alertThreshold">Alert Threshold (JSON)</Label>
              <Input
                id="alertThreshold"
                value={newMonitoring.alertThreshold}
                onChange={(e) => setNewMonitoring({ ...newMonitoring, alertThreshold: e.target.value })}
                placeholder='e.g., {"high": 180, "low": 60}'
                data-testid="input-alert-threshold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMonitoringDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addMonitoringMutation.mutate(newMonitoring)}
              disabled={addMonitoringMutation.isPending}
              data-testid="button-submit-monitoring"
            >
              Add Parameter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CarePlanOverview({ carePlans, onSelectPlan }: { carePlans: CarePlan[]; onSelectPlan: (plan: CarePlan) => void }) {
  const activePlans = carePlans.filter((p) => p.status === "active");
  const pendingPlans = carePlans.filter((p) => p.status === "pending_approval");
  const draftPlans = carePlans.filter((p) => p.status === "draft");
  const completedPlans = carePlans.filter((p) => p.status === "completed");

  const stats = [
    { label: "Active Plans", value: activePlans.length, icon: CheckCircle, color: "text-green-500" },
    { label: "Pending Approval", value: pendingPlans.length, icon: Clock, color: "text-yellow-500" },
    { label: "Drafts", value: draftPlans.length, icon: FileText, color: "text-muted-foreground" },
    { label: "Completed", value: completedPlans.length, icon: Check, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-4 text-center">
            <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {activePlans.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Active Care Plans</h3>
          <div className="space-y-2">
            {activePlans.slice(0, 3).map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover-elevate cursor-pointer"
                onClick={() => onSelectPlan(plan)}
                data-testid={`care-plan-item-${plan.id}`}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{plan.title}</p>
                    <p className="text-sm text-muted-foreground">{categoryLabels[plan.category] || plan.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={priorityColors[plan.priorityLevel]}>{plan.priorityLevel}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingPlans.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Pending Approval</h3>
          <div className="space-y-2">
            {pendingPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover-elevate cursor-pointer"
                onClick={() => onSelectPlan(plan)}
                data-testid={`care-plan-pending-${plan.id}`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">{plan.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {carePlans.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No care plans found</p>
        </div>
      )}
    </div>
  );
}

function CarePlanList({ carePlans, onSelectPlan }: { carePlans: CarePlan[]; onSelectPlan: (plan: CarePlan) => void }) {
  if (carePlans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No care plans found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {carePlans.map((plan) => (
          <div
            key={plan.id}
            className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
            onClick={() => onSelectPlan(plan)}
            data-testid={`care-plan-list-item-${plan.id}`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{plan.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{categoryLabels[plan.category] || plan.category}</span>
                  <span>•</span>
                  <span>v{plan.version}</span>
                  {plan.patientName && (
                    <>
                      <span>•</span>
                      <span>{plan.patientName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[plan.status]}>{plan.status.replace(/_/g, " ")}</Badge>
              <Badge className={priorityColors[plan.priorityLevel]}>{plan.priorityLevel}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

interface CarePlanDetailViewProps {
  carePlan: CarePlanDetail | null;
  isProvider: boolean;
  isLoading: boolean;
  onUpdateStatus: (status: string, notes?: string) => void;
  onAcknowledge: () => void;
  onAddNote: () => void;
  onAddEducation: () => void;
  onAddMonitoring: () => void;
  onCompleteEducation: (id: string) => void;
  isPending: boolean;
}

function CarePlanDetailView({
  carePlan,
  isProvider,
  isLoading,
  onUpdateStatus,
  onAcknowledge,
  onAddNote,
  onAddEducation,
  onAddMonitoring,
  onCompleteEducation,
  isPending,
}: CarePlanDetailViewProps) {
  const [detailTab, setDetailTab] = useState("overview");

  if (isLoading || !carePlan) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = carePlan.progress || { overallProgress: 0, goalsProgress: 0, educationProgress: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{carePlan.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={statusColors[carePlan.status]}>{carePlan.status.replace(/_/g, " ")}</Badge>
            <Badge className={priorityColors[carePlan.priorityLevel]}>{carePlan.priorityLevel}</Badge>
            <Badge variant="outline">{categoryLabels[carePlan.category] || carePlan.category}</Badge>
            <span className="text-sm text-muted-foreground">v{carePlan.version}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!carePlan.patientAcknowledged && !isProvider && carePlan.status === "active" && (
            <Button size="sm" onClick={onAcknowledge} disabled={isPending} data-testid="button-acknowledge">
              <Check className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          )}
          {isProvider && carePlan.status === "draft" && (
            <Button size="sm" onClick={() => onUpdateStatus("pending_approval")} disabled={isPending} data-testid="button-submit-for-approval">
              Submit for Approval
            </Button>
          )}
          {isProvider && carePlan.status === "pending_approval" && (
            <Button size="sm" onClick={() => onUpdateStatus("active")} disabled={isPending} data-testid="button-activate">
              Activate
            </Button>
          )}
          {isProvider && carePlan.status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onUpdateStatus("on_hold")} disabled={isPending} data-testid="button-hold">
                Put on Hold
              </Button>
              <Button size="sm" onClick={() => onUpdateStatus("completed")} disabled={isPending} data-testid="button-complete">
                Mark Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {carePlan.notes && (
        <p className="text-muted-foreground">{carePlan.notes}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Start Date</p>
          <p className="font-medium">{format(new Date(carePlan.startDate), "MMM d, yyyy")}</p>
        </div>
        {carePlan.targetEndDate && (
          <div>
            <p className="text-muted-foreground">End Date</p>
            <p className="font-medium">{format(new Date(carePlan.targetEndDate), "MMM d, yyyy")}</p>
          </div>
        )}
        {carePlan.reviewDate && (
          <div>
            <p className="text-muted-foreground">Review Date</p>
            <p className="font-medium">{format(new Date(carePlan.reviewDate), "MMM d, yyyy")}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Last Updated</p>
          <p className="font-medium">{formatDistanceToNow(new Date(carePlan.updatedAt), { addSuffix: true })}</p>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Progress
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span>{progress.overallProgress}%</span>
            </div>
            <Progress value={progress.overallProgress} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Goals</span>
                <span>{progress.goalsProgress}%</span>
              </div>
              <Progress value={progress.goalsProgress} className="h-1" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Education</span>
                <span>{progress.educationProgress}%</span>
              </div>
              <Progress value={progress.educationProgress} className="h-1" />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="detail-tab-overview">
            <ClipboardList className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="goals" data-testid="detail-tab-goals">
            <Target className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="detail-tab-medications">
            <Pill className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="detail-tab-education">
            <BookOpen className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="detail-tab-monitoring">
            <Activity className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-muted/30 rounded-lg p-3">
              <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{carePlan.goalLinks?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Goals</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <Pill className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-xl font-bold">{carePlan.medicationLinks?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Medications</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <BookOpen className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-xl font-bold">{carePlan.educationLinks?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Education</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <Activity className="h-5 w-5 mx-auto mb-1 text-orange-500" />
              <p className="text-xl font-bold">{carePlan.monitoringParams?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Monitoring</p>
            </div>
          </div>

          {carePlan.progressNotes && carePlan.progressNotes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Recent Notes</h3>
                <Button size="sm" variant="outline" onClick={onAddNote} data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {carePlan.progressNotes.slice(0, 5).map((note) => (
                    <div key={note.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">{note.noteType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{note.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {(!carePlan.progressNotes || carePlan.progressNotes.length === 0) && (
            <div className="text-center py-6 bg-muted/20 rounded-lg">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No progress notes yet</p>
              <Button size="sm" onClick={onAddNote} data-testid="button-add-first-note">
                <Plus className="h-4 w-4 mr-1" />
                Add First Note
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          {carePlan.goalLinks && carePlan.goalLinks.length > 0 ? (
            <div className="space-y-2">
              {carePlan.goalLinks.map((goal) => (
                <div key={goal.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="font-medium">{goal.goalTitle || `Goal ${goal.healthGoalId}`}</span>
                    </div>
                    <Badge variant="outline">Priority: {goal.priority}</Badge>
                  </div>
                  {goal.providerNotes && <p className="text-sm text-muted-foreground mt-2">{goal.providerNotes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No health goals linked to this care plan</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          {carePlan.medicationLinks && carePlan.medicationLinks.length > 0 ? (
            <div className="space-y-2">
              {carePlan.medicationLinks.map((med) => (
                <div key={med.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{med.medicationName || `Medication ${med.medicationReminderId}`}</span>
                      {med.adherenceTarget && <Badge variant="outline">Target: {med.adherenceTarget}%</Badge>}
                    </div>
                  </div>
                  {med.dosageInstructions && (
                    <p className="text-sm text-muted-foreground mt-2">{med.dosageInstructions}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No medications linked to this care plan</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          {isProvider && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={onAddEducation} data-testid="button-add-education">
                <Plus className="h-4 w-4 mr-1" />
                Add Content
              </Button>
            </div>
          )}
          {carePlan.educationLinks && carePlan.educationLinks.length > 0 ? (
            <div className="space-y-2">
              {carePlan.educationLinks.map((edu) => (
                <div key={edu.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{edu.title}</span>
                      <Badge variant="outline">{edu.contentType}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Priority: {edu.priority}</Badge>
                      {edu.completed ? (
                        <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : !isProvider ? (
                        <Button size="sm" variant="outline" onClick={() => onCompleteEducation(edu.id)} data-testid={`button-complete-edu-${edu.id}`}>
                          Mark Complete
                        </Button>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </div>
                  {edu.description && <p className="text-sm text-muted-foreground mt-2">{edu.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No educational content assigned</p>
              {isProvider && (
                <Button size="sm" className="mt-2" onClick={onAddEducation} data-testid="button-add-first-education">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Content
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          {isProvider && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={onAddMonitoring} data-testid="button-add-monitoring">
                <Plus className="h-4 w-4 mr-1" />
                Add Parameter
              </Button>
            </div>
          )}
          {carePlan.monitoringParams && carePlan.monitoringParams.length > 0 ? (
            <div className="space-y-2">
              {carePlan.monitoringParams.map((param) => (
                <div key={param.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">{param.vitalType.replace(/_/g, " ")}</span>
                      {param.alertOnDeviation ? (
                        <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">Alert On</Badge>
                      ) : (
                        <Badge variant="outline">Alert Off</Badge>
                      )}
                    </div>
                    <Badge variant="outline">{param.frequency}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2 flex items-center gap-4">
                    {param.targetMin !== null && <span>Min: {param.targetMin}</span>}
                    {param.targetMax !== null && <span>Max: {param.targetMax}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No monitoring parameters configured</p>
              {isProvider && (
                <Button size="sm" className="mt-2" onClick={onAddMonitoring} data-testid="button-add-first-monitoring">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Parameter
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
