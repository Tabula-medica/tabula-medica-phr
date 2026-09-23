import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  FileText,
  Activity,
  Users,
  ChevronRight,
  Loader2,
  Video,
} from "lucide-react";
import type {
  HighRiskPatient,
  OutreachTalkingPoints,
  OutreachAction,
  OutreachDashboardSummary,
  RiskPriorityLevel,
  OutreachActionType,
  PatientResponseType,
} from "@shared/schema";

const priorityColors: Record<RiskPriorityLevel, string> = {
  critical: "bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-800",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-800",
  moderate: "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-800",
  low: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-800",
};

const actionTypeIcons: Record<OutreachActionType, typeof Phone> = {
  phone_call: Phone,
  secure_message: MessageSquare,
  email: Mail,
  in_person_visit: User,
  video_call: Video,
  care_coordination: Users,
};

function PriorityBadge({ priority }: { priority: RiskPriorityLevel }) {
  return (
    <Badge variant="outline" className={priorityColors[priority]} data-testid={`badge-priority-${priority}`}>
      {priority === "critical" && <AlertTriangle className="mr-1 h-3 w-3" />}
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function TrendIcon({ direction }: { direction?: "worsening" | "stable" | "improving" }) {
  if (direction === "worsening") return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (direction === "improving") return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function PatientCard({ patient, onViewDetails, onGenerateTalkingPoints }: {
  patient: HighRiskPatient;
  onViewDetails: () => void;
  onGenerateTalkingPoints: () => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-patient-${patient.patientId}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate" data-testid={`text-patient-name-${patient.patientId}`}>
              {patient.patientName}
            </CardTitle>
            <CardDescription className="text-xs" data-testid={`text-patient-dob-${patient.patientId}`}>
              DOB: {patient.dateOfBirth} | Risk Score: {patient.riskScore}
            </CardDescription>
          </div>
          <PriorityBadge priority={patient.priorityLevel} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {patient.riskFactors.slice(0, 2).map((rf) => (
            <div key={rf.id} className="flex items-start gap-2 text-sm">
              <TrendIcon direction={rf.trendDirection} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" data-testid={`text-risk-factor-${rf.id}`}>{rf.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{rf.description}</p>
              </div>
            </div>
          ))}
          {patient.riskFactors.length > 2 && (
            <p className="text-xs text-muted-foreground">
              +{patient.riskFactors.length - 2} more risk factors
            </p>
          )}
        </div>

        {patient.recentAlerts.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate" data-testid={`text-alert-${patient.patientId}`}>
              {patient.recentAlerts[0].message}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span data-testid={`text-days-since-contact-${patient.patientId}`}>
              {patient.daysSinceContact} days since contact
            </span>
          </div>
          {patient.contactInfo.phone && (
            <div className="flex items-center gap-1 truncate">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{patient.contactInfo.phone}</span>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onViewDetails}
            className="flex-1"
            data-testid={`button-view-details-${patient.patientId}`}
          >
            View Details
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={onGenerateTalkingPoints}
            className="flex-1"
            data-testid={`button-generate-talking-points-${patient.patientId}`}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            AI Talking Points
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TalkingPointsDialog({ talkingPoints, isLoading, patientName }: {
  talkingPoints: OutreachTalkingPoints | null;
  isLoading: boolean;
  patientName: string;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Generating AI talking points...</p>
      </div>
    );
  }

  if (!talkingPoints) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No talking points available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Opening Statement
          </h4>
          <p className="text-sm bg-primary/5 p-3 rounded-md" data-testid="text-opening-statement">
            {talkingPoints.openingStatement}
          </p>
        </div>

        <div>
          <h4 className="font-medium mb-3">Key Discussion Points</h4>
          <div className="space-y-4">
            {talkingPoints.keyDiscussionPoints.map((point, idx) => (
              <div key={idx} className="flex">
                <div className="w-1 bg-primary shrink-0 rounded-full" />
                <div className="flex-1 pl-3 py-2 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-topic-${idx}`}>{point.topic}</span>
                    <Badge variant="outline" className={
                      point.importance === "critical" ? "bg-red-500/10 text-red-700" :
                      point.importance === "high" ? "bg-orange-500/10 text-orange-700" :
                      "bg-yellow-500/10 text-yellow-700"
                    } data-testid={`badge-importance-${idx}`}>
                      {point.importance}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`text-talking-point-${idx}`}>
                    {point.talkingPoint}
                  </p>
                  {point.suggestedQuestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Questions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {point.suggestedQuestions.map((q, i) => (
                          <li key={i} className="flex items-start gap-1" data-testid={`text-question-${idx}-${i}`}>
                            <span className="text-primary">•</span> {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {talkingPoints.suggestedInterventions.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Suggested Interventions</h4>
            <div className="space-y-3">
              {talkingPoints.suggestedInterventions.map((intervention, idx) => (
                <div key={idx} className="bg-green-500/5 p-3 rounded-md border border-green-200 dark:border-green-800">
                  <p className="font-medium text-sm" data-testid={`text-intervention-${idx}`}>
                    {intervention.intervention}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{intervention.rationale}</p>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {intervention.patientBenefits.map((b, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {b}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-2">Closing Guidance</h4>
          <p className="text-sm bg-primary/5 p-3 rounded-md" data-testid="text-closing-guidance">
            {talkingPoints.closingGuidance}
          </p>
        </div>

        {talkingPoints.messageTemplate && (
          <div>
            <h4 className="font-medium mb-2">Message Template (if call unsuccessful)</h4>
            <Textarea
              readOnly
              value={talkingPoints.messageTemplate}
              className="text-sm"
              rows={3}
              data-testid="textarea-message-template"
            />
          </div>
        )}

        {talkingPoints.escalationTriggers.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              Escalation Triggers
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {talkingPoints.escalationTriggers.map((trigger, idx) => (
                <li key={idx} className="flex items-start gap-2" data-testid={`text-escalation-trigger-${idx}`}>
                  <span className="text-orange-500">!</span> {trigger}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function RecordAttemptDialog({ action, onSuccess }: {
  action: OutreachAction;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState<OutreachActionType>(action.actionType);
  const [response, setResponse] = useState<PatientResponseType>("no_answer");
  const [notes, setNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const recordAttemptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/care-team-outreach/actions/${action.id}/attempts`, { method, response, notes: notes || undefined, nextSteps: nextSteps || undefined });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Attempt recorded", description: "The outreach attempt has been logged." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-outreach/actions"] });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record attempt", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="care-team-outreach-contact-method">Contact Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as OutreachActionType)}>
            <SelectTrigger id="care-team-outreach-contact-method" data-testid="select-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phone_call">Phone Call</SelectItem>
              <SelectItem value="secure_message">Secure Message</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="video_call">Video Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="care-team-outreach-patient-response">Patient Response</Label>
          <Select value={response} onValueChange={(v) => setResponse(v as PatientResponseType)}>
            <SelectTrigger id="care-team-outreach-patient-response" data-testid="select-response">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="answered">Answered</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="no_answer">No Answer</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="callback_requested">Callback Requested</SelectItem>
              <SelectItem value="message_read">Message Read</SelectItem>
              <SelectItem value="message_replied">Message Replied</SelectItem>
              <SelectItem value="appointment_scheduled">Appointment Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="care-team-outreach-notes">Notes</Label>
        <Textarea id="care-team-outreach-notes"
          placeholder="Notes about the conversation..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          data-testid="textarea-notes"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="care-team-outreach-next-steps">Next Steps</Label>
        <Textarea id="care-team-outreach-next-steps"
          placeholder="What should happen next..."
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          rows={2}
          data-testid="textarea-next-steps"
        />
      </div>

      <Button
        onClick={() => recordAttemptMutation.mutate()}
        disabled={recordAttemptMutation.isPending}
        className="w-full"
        data-testid="button-save-attempt"
      >
        {recordAttemptMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Attempt"
        )}
      </Button>
    </div>
  );
}

function DashboardStats({ summary }: { summary: OutreachDashboardSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card data-testid="card-total-high-risk">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High-Risk Patients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-high-risk">
            {summary.totalHighRiskPatients}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {summary.patientsByPriority.map((p) => (
              <Badge key={p.priority} variant="secondary" className="text-xs">
                {p.priority}: {p.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-pending-outreach">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Outreach</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-pending-outreach">
            {summary.pendingOutreachActions}
          </div>
          {summary.overdueActions > 0 && (
            <p className="text-xs text-red-500 mt-1">
              {summary.overdueActions} overdue
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-completed-today">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-completed-today">
            {summary.completedToday}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-response-rate">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-response-rate">
            {summary.averageResponseRate.toFixed(1)}%
          </div>
          <Progress value={summary.averageResponseRate} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CareTeamOutreach() {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<HighRiskPatient | null>(null);
  const [talkingPointsPatientId, setTalkingPointsPatientId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<RiskPriorityLevel | "all">("all");
  const [recordAttemptAction, setRecordAttemptAction] = useState<OutreachAction | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<OutreachDashboardSummary>({
    queryKey: ["/api/care-team-outreach/dashboard"],
  });

  const { data: patients, isLoading: patientsLoading, refetch: refetchPatients } = useQuery<HighRiskPatient[]>({
    queryKey: ["/api/care-team-outreach/high-risk-patients", priorityFilter],
    queryFn: async () => {
      const url = `/api/care-team-outreach/high-risk-patients${priorityFilter !== "all" ? `?priorityLevel=${priorityFilter}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
  });

  const { data: outreachActions, isLoading: actionsLoading } = useQuery<OutreachAction[]>({
    queryKey: ["/api/care-team-outreach/actions"],
  });

  const { data: talkingPoints, isLoading: talkingPointsLoading } = useQuery<OutreachTalkingPoints>({
    queryKey: ["/api/care-team-outreach/talking-points", talkingPointsPatientId],
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/care-team-outreach/talking-points/${talkingPointsPatientId}`);
      return res.json();
    },
    enabled: !!talkingPointsPatientId,
  });

  const autoScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/care-team-outreach/auto-schedule");
      return res.json();
    },
    onSuccess: (data: { actionsCreated: number }) => {
      toast({
        title: "Outreach Scheduled",
        description: `${data.actionsCreated} outreach actions have been automatically scheduled.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team-outreach/actions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to auto-schedule outreach", variant: "destructive" });
    },
  });

  const filteredPatients = patients || [];

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-care-team-outreach">
            Care Team AI Outreach
          </h1>
          <p className="text-muted-foreground">
            AI-powered patient risk analysis and outreach management
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => refetchPatients()}
            data-testid="button-refresh"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => autoScheduleMutation.mutate()}
            disabled={autoScheduleMutation.isPending}
            data-testid="button-auto-schedule"
          >
            {autoScheduleMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Auto-Schedule Outreach
          </Button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : summary ? (
        <DashboardStats summary={summary} />
      ) : null}

      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList data-testid="tabs-main">
          <TabsTrigger value="patients" data-testid="tab-patients">
            <Users className="mr-2 h-4 w-4" />
            High-Risk Patients
          </TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">
            <Calendar className="mr-2 h-4 w-4" />
            Outreach Actions
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            <Activity className="mr-2 h-4 w-4" />
            Team Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="care-team-outreach-filter-by-priority">Filter by Priority:</Label>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as RiskPriorityLevel | "all")}>
              <SelectTrigger id="care-team-outreach-filter-by-priority" className="w-[180px]" data-testid="select-priority-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {patientsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No high-risk patients found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPatients.map((patient) => (
                <PatientCard
                  key={patient.patientId}
                  patient={patient}
                  onViewDetails={() => setSelectedPatient(patient)}
                  onGenerateTalkingPoints={() => setTalkingPointsPatientId(patient.patientId)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          {actionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !outreachActions || outreachActions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No outreach actions scheduled</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => autoScheduleMutation.mutate()}
                  disabled={autoScheduleMutation.isPending}
                  data-testid="button-schedule-first"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Auto-Schedule First Batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {outreachActions.map((action) => {
                const ActionIcon = actionTypeIcons[action.actionType];
                return (
                  <Card key={action.id} data-testid={`card-action-${action.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-full bg-primary/10">
                            <ActionIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate" data-testid={`text-action-patient-${action.id}`}>
                              {action.patientName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {action.reason}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <PriorityBadge priority={action.priority} />
                          <Badge variant={action.status === "completed" ? "default" : "secondary"}>
                            {action.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(action.scheduledDate), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {action.status !== "completed" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRecordAttemptAction(action)}
                                  data-testid={`button-record-attempt-${action.id}`}
                                >
                                  Record Attempt
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Record Outreach Attempt</DialogTitle>
                                  <DialogDescription>
                                    Log the result of your outreach to {action.patientName}
                                  </DialogDescription>
                                </DialogHeader>
                                {recordAttemptAction && (
                                  <RecordAttemptDialog
                                    action={recordAttemptAction}
                                    onSuccess={() => setRecordAttemptAction(null)}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                          )}
                          <Button
                            size="sm"
                            onClick={() => setTalkingPointsPatientId(action.patientId)}
                            data-testid={`button-talking-points-${action.id}`}
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            Talking Points
                          </Button>
                        </div>
                      </div>
                      {action.attempts.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Attempt History ({action.attempts.length})
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {action.attempts.map((attempt) => (
                              <Badge key={attempt.id} variant="outline" className="text-xs">
                                #{attempt.attemptNumber}: {attempt.response}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {summary?.teamPerformance && summary.teamPerformance.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.teamPerformance.map((member) => (
                <Card key={member.memberId} data-testid={`card-team-member-${member.memberId}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-member-name-${member.memberId}`}>
                          {member.memberName}
                        </CardTitle>
                        <CardDescription className="capitalize">{member.role.replace("_", " ")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-2xl font-bold" data-testid={`text-assigned-${member.memberId}`}>
                          {member.assignedPatients}
                        </p>
                        <p className="text-xs text-muted-foreground">Assigned</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600" data-testid={`text-completed-${member.memberId}`}>
                          {member.completedActions}
                        </p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600" data-testid={`text-pending-${member.memberId}`}>
                          {member.pendingActions}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No team performance data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedPatient?.patientName}
            </DialogTitle>
            <DialogDescription>
              Detailed patient risk profile and outreach recommendations
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <PriorityBadge priority={selectedPatient.priorityLevel} />
                  <span className="text-sm text-muted-foreground">
                    Risk Score: {selectedPatient.riskScore}/100
                  </span>
                  <span className="text-sm text-muted-foreground">
                    DOB: {selectedPatient.dateOfBirth}
                  </span>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Risk Factors</h4>
                  <div className="space-y-2">
                    {selectedPatient.riskFactors.map((rf) => (
                      <div key={rf.id} className="p-3 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <TrendIcon direction={rf.trendDirection} />
                          <span className="font-medium">{rf.title}</span>
                          <Badge variant="outline" className={
                            rf.severity === "critical" ? "bg-red-500/10" :
                            rf.severity === "high" ? "bg-orange-500/10" :
                            rf.severity === "moderate" ? "bg-yellow-500/10" :
                            "bg-green-500/10"
                          }>
                            {rf.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rf.description}</p>
                        <div className="flex gap-1 flex-wrap mt-2">
                          {rf.dataPoints.map((dp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{dp}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPatient.recentAlerts.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recent Alerts</h4>
                    <div className="space-y-2">
                      {selectedPatient.recentAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-start gap-2 p-2 bg-orange-500/5 rounded-md border border-orange-200 dark:border-orange-800">
                          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm">{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(alert.timestamp), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedPatient.contactInfo.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {selectedPatient.contactInfo.phone}
                      </div>
                    )}
                    {selectedPatient.contactInfo.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {selectedPatient.contactInfo.email}
                      </div>
                    )}
                    {selectedPatient.primaryProvider && (
                      <div className="flex items-center gap-2 col-span-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Primary: {selectedPatient.primaryProvider}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    setTalkingPointsPatientId(selectedPatient.patientId);
                    setSelectedPatient(null);
                  }}
                  data-testid="button-generate-talking-points-detail"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Talking Points
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!talkingPointsPatientId} onOpenChange={(open) => !open && setTalkingPointsPatientId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Talking Points
            </DialogTitle>
            <DialogDescription>
              Personalized outreach guidance for your patient conversation
            </DialogDescription>
          </DialogHeader>
          <TalkingPointsDialog
            talkingPoints={talkingPoints || null}
            isLoading={talkingPointsLoading}
            patientName={patients?.find((p) => p.patientId === talkingPointsPatientId)?.patientName || ""}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
