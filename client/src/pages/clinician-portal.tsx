import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  Plus,
  MessageSquare,
  Pill,
  Heart,
  Sparkles,
  Search,
  Send,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Shield,
  Loader2,
  FlaskConical,
  Stethoscope,
} from "lucide-react";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PatientSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  medicationsCount: number;
  allergiesCount: number;
  documentsCount: number;
  pendingRecommendations: number;
}

interface PatientDetail {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
    gender: string;
    email: string;
    phone: string;
  };
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    status: string;
    startDate: string;
  }>;
  allergies: Array<{
    id: string;
    name: string;
    severity: string;
    reaction: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
    provider: string;
    annotationsCount: number;
  }>;
  labResults: Array<{
    id: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange?: string;
    status: string;
    date: string;
    isAbnormal: boolean;
  }>;
  appointments: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    type: string;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
  }>;
  aiInsights: Array<{
    type: string;
    title: string;
    description: string;
    priority: string;
  }>;
}

interface Annotation {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  pageNumber?: number;
  createdAt: string;
}

function getPriorityColor(priority: string): "destructive" | "secondary" | "outline" | "default" {
  switch (priority) {
    case "urgent":
    case "high":
      return "destructive";
    case "medium":
      return "default";
    default:
      return "secondary";
  }
}

function getStatusColor(status: string): "destructive" | "secondary" | "outline" | "default" {
  switch (status) {
    case "pending":
      return "secondary";
    case "acknowledged":
      return "default";
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "medication":
      return <Pill className="h-4 w-4" />;
    case "lifestyle":
    case "exercise":
      return <Heart className="h-4 w-4" />;
    case "follow_up":
      return <Calendar className="h-4 w-4" />;
    case "lab_test":
      return <FlaskConical className="h-4 w-4" />;
    case "specialist_referral":
      return <Stethoscope className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export default function ClinicianPortal() {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRecommendationDialog, setShowRecommendationDialog] = useState(false);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    clinician: { id: string; name: string; specialty?: string };
    stats: {
      totalPatients: number;
      pendingRecommendations: number;
      acknowledgedRecommendations: number;
      completedRecommendations: number;
      totalAnnotations: number;
    };
    recentActivity: Array<{
      type: string;
      id: string;
      title: string;
      timestamp: string;
    }>;
    urgentItems: Array<{
      id: string;
      title: string;
      patientId: string;
      priority: string;
    }>;
  }>({
    queryKey: ["/api/clinician-portal/dashboard"],
  });

  const { data: patients, isLoading: patientsLoading } = useQuery<PatientSummary[]>({
    queryKey: ["/api/clinician-portal/patients"],
  });

  const { data: patientDetail, isLoading: patientDetailLoading } = useQuery<PatientDetail>({
    queryKey: ["/api/clinician-portal/patients", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const { data: annotations } = useQuery<Annotation[]>({
    queryKey: ["/api/clinician-portal/patients", selectedPatientId, "documents", selectedDocumentId, "annotations"],
    enabled: !!selectedPatientId && !!selectedDocumentId,
  });

  const createAnnotationMutation = useMutation({
    mutationFn: async (data: { body: string; pageNumber?: number }) => {
      const res = await fetch(`/api/clinician-portal/patients/${selectedPatientId}/documents/${selectedDocumentId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create annotation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-portal/patients", selectedPatientId, "documents", selectedDocumentId, "annotations"] });
      toast({ title: "Annotation added successfully" });
      setShowAnnotationDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to add annotation", variant: "destructive" });
    },
  });

  const createRecommendationMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      category: string;
      priority: string;
      isVisibleToPatient: boolean;
    }) => {
      const res = await fetch(`/api/clinician-portal/patients/${selectedPatientId}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create recommendation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-portal/patients", selectedPatientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-portal/dashboard"] });
      toast({ title: "Recommendation sent to patient" });
      setShowRecommendationDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to send recommendation", variant: "destructive" });
    },
  });

  const filteredPatients = patients?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </div>
    );
  }

  if (selectedPatientId && patientDetail) {
    return (
      <div className="min-h-screen bg-background" data-testid="clinician-patient-detail">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPatientId(null);
                setSelectedDocumentId(null);
              }}
              data-testid="button-back-to-patients"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Patients
            </Button>
            <div className="flex-1" />
            <Button
              onClick={() => setShowRecommendationDialog(true)}
              data-testid="button-add-recommendation"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recommendation
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-2xl" data-testid="text-patient-name">
                    {patientDetail.patient.name}
                  </CardTitle>
                  <CardDescription data-testid="text-patient-info">
                    DOB: {format(new Date(patientDetail.patient.dateOfBirth), "MMM d, yyyy")} |{" "}
                    {patientDetail.patient.gender} | {patientDetail.patient.email}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  HIPAA Protected
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {patientDetail.aiInsights.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5" data-testid="card-ai-insights">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patientDetail.aiInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background/50"
                    data-testid={`insight-item-${idx}`}
                  >
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${insight.priority === "high" ? "text-red-500" : "text-amber-500"}`} />
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-insight-title-${idx}`}>{insight.title}</p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-insight-desc-${idx}`}>{insight.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList data-testid="tabs-patient-sections">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
              <TabsTrigger value="labs" data-testid="tab-labs">Lab Results</TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-medications">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Pill className="h-4 w-4" />
                      Medications ({patientDetail.medications.filter((m) => m.status === "active").length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {patientDetail.medications.filter((m) => m.status === "active").map((med) => (
                          <div key={med.id} className="p-2 rounded border" data-testid={`medication-item-${med.id}`}>
                            <p className="font-medium text-sm" data-testid={`text-med-name-${med.id}`}>{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.dosage} - {med.frequency}</p>
                          </div>
                        ))}
                        {patientDetail.medications.filter((m) => m.status === "active").length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-medications">
                            No active medications
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card data-testid="card-allergies">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4" />
                      Allergies ({patientDetail.allergies.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {patientDetail.allergies.map((allergy) => (
                          <div key={allergy.id} className="p-2 rounded border" data-testid={`allergy-item-${allergy.id}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm" data-testid={`text-allergy-name-${allergy.id}`}>{allergy.name}</p>
                              <Badge
                                variant={allergy.severity === "severe" ? "destructive" : "secondary"}
                                data-testid={`badge-allergy-severity-${allergy.id}`}
                              >
                                {allergy.severity}
                              </Badge>
                            </div>
                            {allergy.reaction && (
                              <p className="text-xs text-muted-foreground">{allergy.reaction}</p>
                            )}
                          </div>
                        ))}
                        {patientDetail.allergies.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-allergies">
                            No known allergies
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-appointments">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    Upcoming Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patientDetail.appointments.slice(0, 3).map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-2 rounded border" data-testid={`appointment-item-${apt.id}`}>
                        <div>
                          <p className="font-medium text-sm" data-testid={`text-apt-title-${apt.id}`}>{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(apt.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <Badge variant="outline">{apt.status}</Badge>
                      </div>
                    ))}
                    {patientDetail.appointments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-appointments">
                        No upcoming appointments
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card data-testid="card-documents-list">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Patient Documents
                  </CardTitle>
                  <CardDescription>Click on a document to view and add annotations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {patientDetail.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate ${selectedDocumentId === doc.id ? "ring-2 ring-primary" : ""}`}
                          onClick={() => setSelectedDocumentId(doc.id)}
                          data-testid={`document-item-${doc.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.type} | {doc.provider} | {format(new Date(doc.date), "MMM d, yyyy")}
                              </p>
                            </div>
                            {doc.annotationsCount > 0 && (
                              <Badge variant="secondary" data-testid={`badge-annotations-${doc.id}`}>
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {doc.annotationsCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {patientDetail.documents.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-documents">
                          No documents available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {selectedDocumentId && (
                <Card data-testid="card-annotations">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4" />
                        Annotations
                      </CardTitle>
                      <Button
                        size="sm"
                        onClick={() => setShowAnnotationDialog(true)}
                        data-testid="button-add-annotation"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Note
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-3">
                        {annotations?.map((annotation) => (
                          <div key={annotation.id} className="p-3 rounded-lg bg-muted/50" data-testid={`annotation-item-${annotation.id}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm" data-testid={`text-annotation-author-${annotation.id}`}>
                                {annotation.authorName}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{annotation.authorRole}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(annotation.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm" data-testid={`text-annotation-body-${annotation.id}`}>{annotation.body}</p>
                          </div>
                        ))}
                        {(!annotations || annotations.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-annotations">
                            No annotations yet
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="labs" className="space-y-4">
              <Card data-testid="card-lab-results">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FlaskConical className="h-4 w-4" />
                    Lab Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {patientDetail.labResults.map((lab) => (
                        <div
                          key={lab.id}
                          className={`p-3 rounded-lg border ${lab.isAbnormal ? "border-red-500/50 bg-red-500/5" : ""}`}
                          data-testid={`lab-item-${lab.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm" data-testid={`text-lab-name-${lab.id}`}>{lab.testName}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(lab.date), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium text-sm ${lab.isAbnormal ? "text-red-600 dark:text-red-400" : ""}`} data-testid={`text-lab-value-${lab.id}`}>
                                {lab.value} {lab.unit}
                              </p>
                              {lab.referenceRange && (
                                <p className="text-xs text-muted-foreground">Ref: {lab.referenceRange}</p>
                              )}
                            </div>
                          </div>
                          {lab.isAbnormal && (
                            <Badge variant="destructive" className="mt-2" data-testid={`badge-abnormal-${lab.id}`}>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Abnormal
                            </Badge>
                          )}
                        </div>
                      ))}
                      {patientDetail.labResults.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-labs">
                          No lab results available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <Card data-testid="card-recommendations">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Send className="h-4 w-4" />
                      Recommendations
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => setShowRecommendationDialog(true)}
                      data-testid="button-new-recommendation"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Recommendation
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {patientDetail.recommendations.map((rec) => (
                        <div key={rec.id} className="p-3 rounded-lg border" data-testid={`recommendation-item-${rec.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              {getCategoryIcon(rec.category)}
                              <div>
                                <p className="font-medium text-sm" data-testid={`text-rec-title-${rec.id}`}>{rec.title}</p>
                                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-rec-desc-${rec.id}`}>{rec.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Created {format(new Date(rec.createdAt), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={getPriorityColor(rec.priority)} data-testid={`badge-rec-priority-${rec.id}`}>
                                {rec.priority}
                              </Badge>
                              <Badge variant={getStatusColor(rec.status)} data-testid={`badge-rec-status-${rec.id}`}>
                                {rec.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                      {patientDetail.recommendations.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-recommendations">
                          No recommendations yet
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={showAnnotationDialog} onOpenChange={setShowAnnotationDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Annotation</DialogTitle>
                <DialogDescription>
                  Add a note or comment to this document. This will be visible to other clinicians.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createAnnotationMutation.mutate({
                    body: formData.get("body") as string,
                  });
                }}
              >
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="annotation-body">Note</Label>
                    <Textarea
                      id="annotation-body"
                      name="body"
                      placeholder="Enter your annotation..."
                      required
                      data-testid="input-annotation-body"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAnnotationDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAnnotationMutation.isPending} data-testid="button-submit-annotation">
                    {createAnnotationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Annotation
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <RecommendationDialog
            open={showRecommendationDialog}
            onOpenChange={setShowRecommendationDialog}
            onSubmit={(data) => createRecommendationMutation.mutate(data)}
            isPending={createRecommendationMutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="clinician-portal">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-portal-title">Clinician Portal</h1>
            <p className="text-muted-foreground" data-testid="text-clinician-welcome">
              Welcome, {dashboardData?.clinician.name}
              {dashboardData?.clinician.specialty && ` | ${dashboardData.clinician.specialty}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.location.href = "/clinician-directory"} data-testid="button-provider-directory">
              <Stethoscope className="h-4 w-4 mr-2" />
              Provider Directory
            </Button>
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              HIPAA Compliant Access
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="stat-total-patients">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-patients">{dashboardData?.stats.totalPatients || 0}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-pending-recommendations">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Recommendations</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-pending">{dashboardData?.stats.pendingRecommendations || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-acknowledged">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Acknowledged</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-acknowledged">{dashboardData?.stats.acknowledgedRecommendations || 0}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-completed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold" data-testid="text-stat-completed">{dashboardData?.stats.completedRecommendations || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {dashboardData?.urgentItems && dashboardData.urgentItems.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5" data-testid="card-urgent-items">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                Urgent Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboardData.urgentItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-background cursor-pointer hover-elevate"
                    onClick={() => setSelectedPatientId(item.patientId)}
                    data-testid={`urgent-item-${item.id}`}
                  >
                    <span className="text-sm font-medium" data-testid={`text-urgent-title-${item.id}`}>{item.title}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-patient-list">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patient List
            </CardTitle>
            <CardDescription>Select a patient to view their health records and add recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-patients"
                />
              </div>
            </div>

            {patientsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredPatients?.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-3 rounded-lg border cursor-pointer hover-elevate"
                      onClick={() => setSelectedPatientId(patient.id)}
                      data-testid={`patient-item-${patient.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-patient-name-${patient.id}`}>{patient.name}</p>
                          <p className="text-xs text-muted-foreground">
                            DOB: {format(new Date(patient.dateOfBirth), "MMM d, yyyy")} | {patient.gender}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs" data-testid={`badge-meds-${patient.id}`}>
                            <Pill className="h-3 w-3 mr-1" />
                            {patient.medicationsCount}
                          </Badge>
                          <Badge variant="outline" className="text-xs" data-testid={`badge-docs-${patient.id}`}>
                            <FileText className="h-3 w-3 mr-1" />
                            {patient.documentsCount}
                          </Badge>
                          {patient.pendingRecommendations > 0 && (
                            <Badge variant="secondary" data-testid={`badge-pending-${patient.id}`}>
                              {patient.pendingRecommendations} pending
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {filteredPatients?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-patients">
                      No patients found
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecommendationDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    isVisibleToPatient: boolean;
  }) => void;
  isPending: boolean;
}) {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Recommendation</DialogTitle>
          <DialogDescription>
            Share a personalized recommendation with this patient. They will see it on their dashboard.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onSubmit({
              title: formData.get("title") as string,
              description: formData.get("description") as string,
              category: formData.get("category") as string,
              priority: formData.get("priority") as string,
              isVisibleToPatient: isVisible,
            });
          }}
        >
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rec-title">Title</Label>
              <Input
                id="rec-title"
                name="title"
                placeholder="e.g., Schedule follow-up appointment"
                required
                data-testid="input-rec-title"
              />
            </div>
            <div>
              <Label htmlFor="rec-description">Description</Label>
              <Textarea
                id="rec-description"
                name="description"
                placeholder="Provide details about this recommendation..."
                required
                data-testid="input-rec-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rec-category">Category</Label>
                <Select name="category" defaultValue="follow_up">
                  <SelectTrigger data-testid="select-rec-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="lifestyle">Lifestyle</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="lab_test">Lab Test</SelectItem>
                    <SelectItem value="specialist_referral">Specialist Referral</SelectItem>
                    <SelectItem value="preventive_care">Preventive Care</SelectItem>
                    <SelectItem value="diet_nutrition">Diet & Nutrition</SelectItem>
                    <SelectItem value="exercise">Exercise</SelectItem>
                    <SelectItem value="mental_health">Mental Health</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rec-priority">Priority</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger data-testid="select-rec-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="visible-to-patient"
                checked={isVisible}
                onCheckedChange={setIsVisible}
                data-testid="switch-visible-to-patient"
              />
              <Label htmlFor="visible-to-patient" className="text-sm">
                Visible to patient on their dashboard
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-recommendation">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Recommendation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
