import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Zap,
  ClipboardList,
  Calendar,
  FileText,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

interface InsightWorkflowActionsProps {
  patientId: string;
  patientName: string;
  insight: string;
  insightCategory?: string;
  sourceData?: {
    source?: string;
    date?: string;
    excerpt?: string;
  };
  compact?: boolean;
}

type ActionType = "task" | "appointment" | "note";

interface TaskFormData {
  taskType: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}

interface AppointmentFormData {
  appointmentType: string;
  reason: string;
  preferredDate: string;
  preferredTimeSlot: string;
  urgency: string;
}

interface NoteFormData {
  noteType: string;
  content: string;
  category: string;
}

function extractKeyInfo(insight: string, sourceData?: { source?: string; date?: string; excerpt?: string }) {
  const quoteMatch = insight.match(/['"]([^'"]+)['"]/);
  const quote = quoteMatch ? quoteMatch[1] : (sourceData?.excerpt || insight.slice(0, 200));
  
  const source = sourceData?.source || "Health Record";
  const date = sourceData?.date || new Date().toISOString().split("T")[0];
  
  return { quote, source, date };
}

function generateTaskDefaults(
  insight: string,
  patientName: string,
  category?: string,
  sourceData?: { source?: string; date?: string; excerpt?: string }
): TaskFormData {
  const { quote, source, date } = extractKeyInfo(insight, sourceData);
  
  let taskType = "review_results";
  
  if (category === "lab_trend") {
    taskType = "review_results";
  } else if (category === "medication") {
    taskType = "prescription_renewal";
  } else if (category === "condition") {
    taskType = "care_plan_update";
  } else if (category === "appointment") {
    taskType = "patient_callback";
  }
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return {
    taskType,
    title: `Review AI insight for ${patientName}`,
    description: `AI-generated insight from ${source} (${date}):\n\n"${quote}"\n\nAction needed: Review and follow up as appropriate.`,
    priority: "normal",
    dueDate: tomorrow.toISOString().split("T")[0],
  };
}

function generateAppointmentDefaults(
  insight: string,
  patientName: string,
  category?: string,
  sourceData?: { source?: string; date?: string; excerpt?: string }
): AppointmentFormData {
  const { quote, source } = extractKeyInfo(insight, sourceData);
  
  let appointmentType = "follow_up";
  
  if (category === "lab_trend") {
    appointmentType = "follow_up";
  } else if (category === "condition") {
    appointmentType = "consultation";
  } else if (category === "appointment") {
    appointmentType = "follow_up";
  }
  
  const preferredDate = new Date();
  preferredDate.setDate(preferredDate.getDate() + 7);
  
  return {
    appointmentType,
    reason: `Follow-up based on AI insight: "${quote.slice(0, 100)}${quote.length > 100 ? '...' : ''}"`,
    preferredDate: preferredDate.toISOString().split("T")[0],
    preferredTimeSlot: "Morning",
    urgency: "routine",
  };
}

function generateNoteDefaults(
  insight: string,
  patientName: string,
  category?: string,
  sourceData?: { source?: string; date?: string; excerpt?: string }
): NoteFormData {
  const { quote, source, date } = extractKeyInfo(insight, sourceData);
  
  let noteType = "clinical_observation";
  let noteCategory = "progress";
  
  if (category === "lab_trend") {
    noteType = "lab_interpretation";
    noteCategory = "lab_results";
  } else if (category === "medication") {
    noteType = "medication_note";
    noteCategory = "medications";
  }
  
  return {
    noteType,
    content: `AI-Assisted Chart Note\n\nSource: ${source} (${date})\nInsight: ${quote}\n\nClinician Assessment:\n[Add your clinical interpretation here]\n\nPlan:\n[Document any follow-up actions]`,
    category: noteCategory,
  };
}

export function InsightWorkflowActions({
  patientId,
  patientName,
  insight,
  insightCategory,
  sourceData,
  compact = false,
}: InsightWorkflowActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormData>(() =>
    generateTaskDefaults(insight, patientName, insightCategory, sourceData)
  );
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormData>(() =>
    generateAppointmentDefaults(insight, patientName, insightCategory, sourceData)
  );
  const [noteForm, setNoteForm] = useState<NoteFormData>(() =>
    generateNoteDefaults(insight, patientName, insightCategory, sourceData)
  );
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return apiRequest("POST", "/api/clinician-workflow/task", {
        ...data,
        patientId,
        patientName,
        insightSource: insight.slice(0, 500),
      });
    },
    onSuccess: () => {
      toast({
        title: "Task Created",
        description: `Follow-up task for ${patientName} has been added to your task list.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard"] });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      return apiRequest("POST", "/api/clinician-workflow/appointment", {
        ...data,
        patientId,
        patientName,
        insightSource: insight.slice(0, 500),
      });
    },
    onSuccess: () => {
      toast({
        title: "Appointment Requested",
        description: `Appointment request for ${patientName} has been submitted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard"] });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to request appointment. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      return apiRequest("POST", "/api/clinician-workflow/chart-note", {
        ...data,
        patientId,
        patientName,
        insightSource: insight.slice(0, 500),
      });
    },
    onSuccess: () => {
      toast({
        title: "Note Added",
        description: `Chart note for ${patientName} has been saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health-record", patientId] });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add chart note. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleActionSelect = (action: ActionType) => {
    setActionType(action);
    if (action === "task") {
      setTaskForm(generateTaskDefaults(insight, patientName, insightCategory, sourceData));
    } else if (action === "appointment") {
      setAppointmentForm(generateAppointmentDefaults(insight, patientName, insightCategory, sourceData));
    } else if (action === "note") {
      setNoteForm(generateNoteDefaults(insight, patientName, insightCategory, sourceData));
    }
    setDialogOpen(true);
  };
  
  const handleSubmit = () => {
    if (actionType === "task") {
      createTaskMutation.mutate(taskForm);
    } else if (actionType === "appointment") {
      createAppointmentMutation.mutate(appointmentForm);
    } else if (actionType === "note") {
      createNoteMutation.mutate(noteForm);
    }
  };
  
  const isPending = createTaskMutation.isPending || createAppointmentMutation.isPending || createNoteMutation.isPending;
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              data-testid="button-workflow-actions"
            >
              <Zap className="h-3.5 w-3.5" />
              Actions
              <ChevronDown className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              data-testid="button-workflow-actions"
            >
              <Zap className="h-4 w-4" />
              Quick Actions
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Assisted Actions
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleActionSelect("task")}
            className="gap-2 cursor-pointer"
            data-testid="action-create-task"
          >
            <ClipboardList className="h-4 w-4" />
            <div>
              <p className="font-medium">Create Follow-up Task</p>
              <p className="text-xs text-muted-foreground">Add to your task list</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleActionSelect("appointment")}
            className="gap-2 cursor-pointer"
            data-testid="action-schedule-appointment"
          >
            <Calendar className="h-4 w-4" />
            <div>
              <p className="font-medium">Schedule Appointment</p>
              <p className="text-xs text-muted-foreground">Request patient visit</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleActionSelect("note")}
            className="gap-2 cursor-pointer"
            data-testid="action-add-note"
          >
            <FileText className="h-4 w-4" />
            <div>
              <p className="font-medium">Add Chart Note</p>
              <p className="text-xs text-muted-foreground">Document in patient record</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "task" && <ClipboardList className="h-5 w-5" />}
              {actionType === "appointment" && <Calendar className="h-5 w-5" />}
              {actionType === "note" && <FileText className="h-5 w-5" />}
              {actionType === "task" && "Create Follow-up Task"}
              {actionType === "appointment" && "Schedule Appointment"}
              {actionType === "note" && "Add Chart Note"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Pre-filled from AI insight
              </Badge>
              for {patientName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {actionType === "task" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-type">Task Type</Label>
                    <Select
                      value={taskForm.taskType}
                      onValueChange={(v) => setTaskForm({ ...taskForm, taskType: v })}
                    >
                      <SelectTrigger id="task-type" data-testid="select-task-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="review_results">Review Results</SelectItem>
                        <SelectItem value="patient_callback">Patient Callback</SelectItem>
                        <SelectItem value="prescription_renewal">Prescription Renewal</SelectItem>
                        <SelectItem value="care_plan_update">Care Plan Update</SelectItem>
                        <SelectItem value="respond_message">Respond to Message</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={taskForm.priority}
                      onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                    >
                      <SelectTrigger id="priority" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    data-testid="input-task-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={4}
                    data-testid="textarea-task-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    data-testid="input-due-date"
                  />
                </div>
              </>
            )}
            
            {actionType === "appointment" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appt-type">Appointment Type</Label>
                    <Select
                      value={appointmentForm.appointmentType}
                      onValueChange={(v) => setAppointmentForm({ ...appointmentForm, appointmentType: v })}
                    >
                      <SelectTrigger id="appt-type" data-testid="select-appointment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="telehealth">Telehealth</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency</Label>
                    <Select
                      value={appointmentForm.urgency}
                      onValueChange={(v) => setAppointmentForm({ ...appointmentForm, urgency: v })}
                    >
                      <SelectTrigger id="urgency" data-testid="select-urgency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="soon">Soon</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Visit</Label>
                  <Textarea
                    id="reason"
                    value={appointmentForm.reason}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                    rows={3}
                    data-testid="textarea-appointment-reason"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferred-date">Preferred Date</Label>
                    <Input
                      id="preferred-date"
                      type="date"
                      value={appointmentForm.preferredDate}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, preferredDate: e.target.value })}
                      data-testid="input-preferred-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time-slot">Time Preference</Label>
                    <Select
                      value={appointmentForm.preferredTimeSlot}
                      onValueChange={(v) => setAppointmentForm({ ...appointmentForm, preferredTimeSlot: v })}
                    >
                      <SelectTrigger id="time-slot" data-testid="select-time-slot">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Afternoon">Afternoon</SelectItem>
                        <SelectItem value="Late Morning">Late Morning</SelectItem>
                        <SelectItem value="Any">Any</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            
            {actionType === "note" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="note-type">Note Type</Label>
                    <Select
                      value={noteForm.noteType}
                      onValueChange={(v) => setNoteForm({ ...noteForm, noteType: v })}
                    >
                      <SelectTrigger id="note-type" data-testid="select-note-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinical_observation">Clinical Observation</SelectItem>
                        <SelectItem value="lab_interpretation">Lab Interpretation</SelectItem>
                        <SelectItem value="medication_note">Medication Note</SelectItem>
                        <SelectItem value="care_coordination">Care Coordination</SelectItem>
                        <SelectItem value="patient_communication">Patient Communication</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={noteForm.category}
                      onValueChange={(v) => setNoteForm({ ...noteForm, category: v })}
                    >
                      <SelectTrigger id="category" data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="progress">Progress Note</SelectItem>
                        <SelectItem value="lab_results">Lab Results</SelectItem>
                        <SelectItem value="medications">Medications</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                        <SelectItem value="plan">Plan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Note Content</Label>
                  <Textarea
                    id="content"
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-note-content"
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {actionType === "task" && "Create Task"}
                  {actionType === "appointment" && "Request Appointment"}
                  {actionType === "note" && "Save Note"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
