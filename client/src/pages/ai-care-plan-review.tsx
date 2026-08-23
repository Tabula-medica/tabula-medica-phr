import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Brain,
  Sparkles,
  Pill,
  Heart,
  Calendar,
  BookOpen,
  Check,
  X,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileCheck,
  Edit3,
  MessageSquare,
  User,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import type {
  AICarePlanDraft,
  AICarePlanMedicationRec,
  AICarePlanLifestyleRec,
  AICarePlanAppointmentRec,
  AICarePlanEducationRec,
} from "@shared/schema";

type SectionType = "medications" | "lifestyle" | "appointments" | "education";

const statusColors: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  revisions_requested: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  assigned: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const statusLabels: Record<string, string> = {
  pending_review: "Pending Review",
  under_review: "Under Review",
  revisions_requested: "Revisions Requested",
  approved: "Approved",
  rejected: "Rejected",
  assigned: "Assigned to Patient",
};

export default function AICarePlanReviewPage() {
  const { toast } = useToast();
  const [selectedDraft, setSelectedDraft] = useState<AICarePlanDraft | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType>("medications");
  const [feedbackText, setFeedbackText] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<{ section: SectionType; item: any } | null>(null);

  const { data: drafts = [], isLoading } = useQuery<AICarePlanDraft[]>({
    queryKey: ["/api/ai-care-plan-drafts"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ draftId, feedback }: { draftId: string; feedback?: string }) => {
      const res = await apiRequest("POST", `/api/ai-care-plan-drafts/${draftId}/approve`, { feedback });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      setShowApproveDialog(false);
      setSelectedDraft(null);
      toast({ title: "Care Plan Approved", description: "The AI care plan has been approved and is ready for assignment." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve care plan.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ draftId, reason }: { draftId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/ai-care-plan-drafts/${draftId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      setShowRejectDialog(false);
      setSelectedDraft(null);
      setRejectionReason("");
      toast({ title: "Care Plan Rejected", description: "The AI care plan has been rejected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject care plan.", variant: "destructive" });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: async ({ draftId, feedback }: { draftId: string; feedback: string }) => {
      const res = await apiRequest("POST", `/api/ai-care-plan-drafts/${draftId}/request-revisions`, { feedback });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      setShowRevisionDialog(false);
      setFeedbackText("");
      toast({ title: "Revisions Requested", description: "Your feedback has been recorded for AI regeneration." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request revisions.", variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await apiRequest("POST", `/api/ai-care-plan-drafts/${draftId}/assign`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      setSelectedDraft(null);
      toast({ title: "Care Plan Assigned", description: "The care plan has been assigned to the patient." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign care plan.", variant: "destructive" });
    },
  });

  const toggleApprovalMutation = useMutation({
    mutationFn: async ({ draftId, section, itemId, approved, notes }: { draftId: string; section: SectionType; itemId: string; approved: boolean; notes?: string }) => {
      const res = await apiRequest("POST", `/api/ai-care-plan-drafts/${draftId}/${section}/${itemId}/toggle-approval`, { approved, notes });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      if (selectedDraft) {
        setSelectedDraft(data);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update recommendation.", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ draftId, section, itemId, updates }: { draftId: string; section: SectionType; itemId: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/ai-care-plan-drafts/${draftId}/${section}/${itemId}`, updates);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-care-plan-drafts"] });
      if (selectedDraft) {
        setSelectedDraft(data);
      }
      setEditingItem(null);
      toast({ title: "Updated", description: "Recommendation updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update recommendation.", variant: "destructive" });
    },
  });

  const pendingCount = drafts.filter(d => d.status === "pending_review").length;
  const underReviewCount = drafts.filter(d => d.status === "under_review").length;
  const approvedCount = drafts.filter(d => d.status === "approved").length;

  const renderMedicationCard = (med: AICarePlanMedicationRec) => (
    <Card key={med.id} className={`mb-3 ${med.clinicianApproved ? "border-green-300 dark:border-green-700" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Pill className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{med.name}</span>
              <Badge variant="outline">{med.dosage}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{med.frequency}</p>
            <p className="text-sm">{med.rationale}</p>
            {med.sideEffects && med.sideEffects.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Side effects: </span>
                <span className="text-xs">{med.sideEffects.join(", ")}</span>
              </div>
            )}
            {med.clinicianNotes && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Clinician notes: </span>{med.clinicianNotes}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={med.clinicianApproved || false}
              onCheckedChange={(checked) => {
                if (selectedDraft) {
                  toggleApprovalMutation.mutate({
                    draftId: selectedDraft.id,
                    section: "medications",
                    itemId: med.id,
                    approved: checked,
                  });
                }
              }}
              data-testid={`switch-med-approval-${med.id}`}
            />
            <span className="text-xs text-muted-foreground">
              {med.clinicianApproved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderLifestyleCard = (item: AICarePlanLifestyleRec) => (
    <Card key={item.id} className={`mb-3 ${item.clinicianApproved ? "border-green-300 dark:border-green-700" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="font-medium">{item.title}</span>
              <Badge variant="outline" className="capitalize">{item.category}</Badge>
              <Badge className={item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-yellow-500" : "bg-gray-500"}>
                {item.priority}
              </Badge>
            </div>
            <p className="text-sm mb-2">{item.description}</p>
            <p className="text-xs text-muted-foreground">Frequency: {item.frequency}</p>
            <p className="text-xs text-muted-foreground mt-1">Evidence: {item.evidenceBasis}</p>
            {item.clinicianNotes && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Clinician notes: </span>{item.clinicianNotes}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={item.clinicianApproved || false}
              onCheckedChange={(checked) => {
                if (selectedDraft) {
                  toggleApprovalMutation.mutate({
                    draftId: selectedDraft.id,
                    section: "lifestyle",
                    itemId: item.id,
                    approved: checked,
                  });
                }
              }}
              data-testid={`switch-lifestyle-approval-${item.id}`}
            />
            <span className="text-xs text-muted-foreground">
              {item.clinicianApproved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAppointmentCard = (apt: AICarePlanAppointmentRec) => (
    <Card key={apt.id} className={`mb-3 ${apt.clinicianApproved ? "border-green-300 dark:border-green-700" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-purple-500" />
              <span className="font-medium capitalize">{apt.type.replace("_", " ")}</span>
              {apt.specialty && <Badge variant="outline">{apt.specialty}</Badge>}
              <Badge className={apt.priority === "urgent" ? "bg-red-500" : apt.priority === "routine" ? "bg-blue-500" : "bg-green-500"}>
                {apt.priority}
              </Badge>
            </div>
            <p className="text-sm mb-2">{apt.purpose}</p>
            <p className="text-xs text-muted-foreground">Timeframe: {apt.suggestedTimeframe}</p>
            <p className="text-xs mt-1">{apt.rationale}</p>
            {apt.clinicianNotes && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Clinician notes: </span>{apt.clinicianNotes}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={apt.clinicianApproved || false}
              onCheckedChange={(checked) => {
                if (selectedDraft) {
                  toggleApprovalMutation.mutate({
                    draftId: selectedDraft.id,
                    section: "appointments",
                    itemId: apt.id,
                    approved: checked,
                  });
                }
              }}
              data-testid={`switch-apt-approval-${apt.id}`}
            />
            <span className="text-xs text-muted-foreground">
              {apt.clinicianApproved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEducationCard = (edu: AICarePlanEducationRec) => (
    <Card key={edu.id} className={`mb-3 ${edu.clinicianApproved ? "border-green-300 dark:border-green-700" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              <span className="font-medium">{edu.topic}</span>
            </div>
            <p className="text-sm mb-2">{edu.summary}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {edu.resources.map((res, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {res.type}: {res.title}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{edu.relevance}</p>
            {edu.clinicianNotes && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Clinician notes: </span>{edu.clinicianNotes}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={edu.clinicianApproved || false}
              onCheckedChange={(checked) => {
                if (selectedDraft) {
                  toggleApprovalMutation.mutate({
                    draftId: selectedDraft.id,
                    section: "education",
                    itemId: edu.id,
                    approved: checked,
                  });
                }
              }}
              data-testid={`switch-edu-approval-${edu.id}`}
            />
            <span className="text-xs text-muted-foreground">
              {edu.clinicianApproved ? "Approved" : "Pending"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Care Plan Review</h1>
          <Badge variant="outline" className="ml-2">
            <Sparkles className="h-3 w-3 mr-1" />
            Clinician Approval Workflow
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Review, edit, and approve AI-generated care plans before assigning to patients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <Edit3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{underReviewCount}</p>
              <p className="text-sm text-muted-foreground">Under Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Care Plan Drafts
            </CardTitle>
            <CardDescription>Select a draft to review</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {drafts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No care plan drafts available</p>
                </div>
              ) : (
                drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`p-4 rounded-lg border mb-3 cursor-pointer transition-colors hover-elevate ${
                      selectedDraft?.id === draft.id ? "border-primary bg-muted" : ""
                    }`}
                    {...clickable(() => setSelectedDraft(draft))}
                    data-testid={`draft-card-${draft.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{draft.patientName}</span>
                      </div>
                      <Badge className={statusColors[draft.status]}>
                        {statusLabels[draft.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{draft.primaryCondition}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(draft.generatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedDraft ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      {selectedDraft.patientName} - {selectedDraft.primaryCondition}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Generated {new Date(selectedDraft.generatedAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[selectedDraft.status]}>
                    {statusLabels[selectedDraft.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="analysis" className="mb-4">
                  <AccordionItem value="analysis">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        AI Analysis Summary
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm mb-4">{selectedDraft.analysisNotes}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Conditions</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedDraft.conditions.map((c, i) => (
                                <Badge key={i} variant="secondary">{c}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Treatment Goals</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedDraft.treatmentGoals.map((g, i) => (
                                <Badge key={i} variant="outline">{g}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        {selectedDraft.riskFactors.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Risk Factors</p>
                            {selectedDraft.riskFactors.map((rf, i) => (
                              <div key={i} className="flex items-center gap-2 mb-1">
                                <AlertTriangle className={`h-3 w-3 ${rf.severity === "high" ? "text-red-500" : rf.severity === "medium" ? "text-yellow-500" : "text-gray-500"}`} />
                                <span className="text-sm">{rf.factor}</span>
                                <span className="text-xs text-muted-foreground">- {rf.mitigation}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionType)}>
                  <TabsList className="w-full grid grid-cols-4 mb-4">
                    <TabsTrigger value="medications" className="flex items-center gap-1" data-testid="tab-medications">
                      <Pill className="h-4 w-4" />
                      Medications
                    </TabsTrigger>
                    <TabsTrigger value="lifestyle" className="flex items-center gap-1" data-testid="tab-lifestyle">
                      <Heart className="h-4 w-4" />
                      Lifestyle
                    </TabsTrigger>
                    <TabsTrigger value="appointments" className="flex items-center gap-1" data-testid="tab-appointments">
                      <Calendar className="h-4 w-4" />
                      Appointments
                    </TabsTrigger>
                    <TabsTrigger value="education" className="flex items-center gap-1" data-testid="tab-education">
                      <BookOpen className="h-4 w-4" />
                      Education
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[350px] pr-4">
                    <TabsContent value="medications" className="mt-0">
                      {selectedDraft.medications.map(renderMedicationCard)}
                    </TabsContent>
                    <TabsContent value="lifestyle" className="mt-0">
                      {selectedDraft.lifestyle.map(renderLifestyleCard)}
                    </TabsContent>
                    <TabsContent value="appointments" className="mt-0">
                      {selectedDraft.appointments.map(renderAppointmentCard)}
                    </TabsContent>
                    <TabsContent value="education" className="mt-0">
                      {selectedDraft.education.map(renderEducationCard)}
                    </TabsContent>
                  </ScrollArea>
                </Tabs>

                <Separator className="my-4" />

                <div className="flex flex-wrap gap-3 justify-end">
                  {selectedDraft.status === "pending_review" || selectedDraft.status === "under_review" ? (
                    <>
                      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" data-testid="button-request-revisions">
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Request Revisions
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Request Revisions</DialogTitle>
                            <DialogDescription>
                              Provide feedback for the AI to regenerate with adjustments.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea
                            placeholder="Describe what changes are needed..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            className="min-h-[100px]"
                            data-testid="textarea-revision-feedback"
                          />
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                if (selectedDraft && feedbackText) {
                                  revisionMutation.mutate({ draftId: selectedDraft.id, feedback: feedbackText });
                                }
                              }}
                              disabled={!feedbackText || revisionMutation.isPending}
                              data-testid="button-submit-revisions"
                            >
                              {revisionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Submit Feedback
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                        <DialogTrigger asChild>
                          <Button variant="destructive" data-testid="button-reject">
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reject Care Plan</DialogTitle>
                            <DialogDescription>
                              Please provide a reason for rejecting this care plan.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="min-h-[100px]"
                            data-testid="textarea-rejection-reason"
                          />
                          <DialogFooter>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                if (selectedDraft && rejectionReason) {
                                  rejectMutation.mutate({ draftId: selectedDraft.id, reason: rejectionReason });
                                }
                              }}
                              disabled={!rejectionReason || rejectMutation.isPending}
                              data-testid="button-confirm-reject"
                            >
                              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Confirm Rejection
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-approve">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve Care Plan
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <ShieldCheck className="h-5 w-5 text-green-500" />
                              Approve AI Care Plan
                            </DialogTitle>
                            <DialogDescription>
                              You are approving this AI-generated care plan for {selectedDraft.patientName}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm">
                              <strong>Condition:</strong> {selectedDraft.primaryCondition}
                            </p>
                            <p className="text-sm">
                              <strong>Recommendations:</strong> {selectedDraft.medications.length} medications, {selectedDraft.lifestyle.length} lifestyle changes, {selectedDraft.appointments.length} appointments
                            </p>
                            <Textarea
                              placeholder="Optional: Add approval notes..."
                              value={feedbackText}
                              onChange={(e) => setFeedbackText(e.target.value)}
                              data-testid="textarea-approval-notes"
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                if (selectedDraft) {
                                  approveMutation.mutate({ draftId: selectedDraft.id, feedback: feedbackText });
                                }
                              }}
                              disabled={approveMutation.isPending}
                              data-testid="button-confirm-approve"
                            >
                              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Confirm Approval
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : selectedDraft.status === "approved" ? (
                    <Button
                      onClick={() => assignMutation.mutate(selectedDraft.id)}
                      disabled={assignMutation.isPending}
                      data-testid="button-assign-to-patient"
                    >
                      {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Send className="h-4 w-4 mr-2" />
                      Assign to Patient
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <div className="text-center text-muted-foreground">
                <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a care plan draft to review</p>
                <p className="text-sm mt-2">Review AI recommendations and approve for patient assignment</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-ai-care-plan-review-disclaimer" />
    </div>
  );
}