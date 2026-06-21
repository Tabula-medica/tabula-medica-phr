import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  Heart,
  Info,
  Pill,
  Plus,
  Radiation,
  Scissors,
  Shield,
  Stethoscope,
  Upload,
  User,
  Building2,
  Phone,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  Syringe,
  Target,
  Microscope,
  ClipboardList,
  Loader2,
} from "lucide-react";
import type {
  CancerBasics,
  CancerTimelineEntry,
  CancerDocument,
  CancerFolderType,
  TreatmentType,
} from "@shared/schema";
import {
  cancerFolderLabels,
  treatmentTypeLabels,
  cancerTypeLabels,
  treatmentTypes,
  cancerFolderTypes,
} from "@shared/schema";

const SAMPLE_CANCER_ID = "cancer-track-1";

const treatmentIcons: Record<TreatmentType, typeof Activity> = {
  diagnosis: Stethoscope,
  surgery: Scissors,
  chemotherapy: FlaskConical,
  radiation: Radiation,
  immunotherapy: Shield,
  hormone_therapy: Pill,
  targeted_therapy: Target,
  stem_cell_transplant: Syringe,
  bone_marrow_transplant: Syringe,
  clinical_trial: Microscope,
  palliative_care: Heart,
  watchful_waiting: Clock,
  other: Activity,
};

const folderIcons: Partial<Record<CancerFolderType, typeof FileText>> = {
  diagnosis_pathology: Microscope,
  pathology_reports: Microscope,
  biopsy_results: Microscope,
  molecular_biomarkers: Microscope,
  imaging: Radiation,
  imaging_pet_ct: Radiation,
  imaging_ct: Radiation,
  imaging_mri: Radiation,
  imaging_ultrasound: Radiation,
  treatment: Activity,
  treatment_surgery: Scissors,
  treatment_chemo: FlaskConical,
  treatment_radiation: Radiation,
  treatment_immunotherapy: Shield,
  treatment_hormonal: Pill,
  treatment_clinical_trials: Microscope,
  oncology_notes: Stethoscope,
  notes_medical_oncology: Stethoscope,
  notes_radiation_oncology: Radiation,
  notes_surgical_oncology: Scissors,
  chemo_orders: FlaskConical,
  infusion_orders: Syringe,
  infusion_summaries: Syringe,
  tumor_board_notes: ClipboardList,
  labs: FlaskConical,
  labs_tumor_markers: FlaskConical,
  survivorship: Heart,
  survivorship_care_plan: Heart,
  followup_schedule: Calendar,
  complications: AlertTriangle,
  other: FileText,
};

export default function CancerTrack() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedFolder, setSelectedFolder] = useState<CancerFolderType | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAddTreatmentDialog, setShowAddTreatmentDialog] = useState(false);
  const { toast } = useToast();

  const { data: cancerData, isLoading: loadingCancer } = useQuery<CancerBasics>({
    queryKey: ["/api/cancer-track", SAMPLE_CANCER_ID],
  });

  const { data: timeline, isLoading: loadingTimeline } = useQuery<CancerTimelineEntry[]>({
    queryKey: ["/api/cancer-track", SAMPLE_CANCER_ID, "timeline"],
  });

  const { data: folderCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/cancer-track", SAMPLE_CANCER_ID, "folders"],
  });

  const documentsUrl = selectedFolder 
    ? `/api/cancer-track/${SAMPLE_CANCER_ID}/documents?folder=${selectedFolder}`
    : `/api/cancer-track/${SAMPLE_CANCER_ID}/documents`;
  const { data: documents, isLoading: loadingDocs } = useQuery<CancerDocument[]>({
    queryKey: [documentsUrl],
  });

  if (loadingCancer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cancerData) {
    return (
      <div className="container max-w-6xl py-6 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Cancer Track Found</h2>
            <p className="text-muted-foreground mb-6">
              Start tracking your cancer journey by adding your diagnosis information.
            </p>
            <Button size="lg" data-testid="button-start-cancer-track">
              <Plus className="h-5 w-5 mr-2" />
              Start Cancer Track
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ongoingTreatments = timeline?.filter(t => t.isOngoing) || [];
  const completedTreatments = timeline?.filter(t => !t.isOngoing) || [];

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6" id="main-content">
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>NOT medical advice.</strong> This is a personal health record tool. 
          Always consult your oncology team for treatment decisions.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Cancer Track
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            Your structured oncology timeline and document management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
          <Button onClick={() => setShowAddTreatmentDialog(true)} data-testid="button-add-treatment">
            <Plus className="h-4 w-4 mr-2" />
            Add Treatment
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {cancerTypeLabels[cancerData.cancerType]}
              </Badge>
              {cancerData.stage && (
                <Badge variant="outline" className="text-base px-3 py-1">
                  Stage {cancerData.stage}
                </Badge>
              )}
            </div>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Diagnosed: {new Date(cancerData.diagnosisDate).toLocaleDateString()}
            </div>
            {cancerData.inRemission && (
              <>
                <Separator orientation="vertical" className="h-6 hidden sm:block" />
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  In Remission
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Care Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Diagnosis Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Cancer Type</p>
                    <p className="font-medium">{cancerTypeLabels[cancerData.cancerType]}</p>
                  </div>
                  {cancerData.subtype && (
                    <div>
                      <p className="text-sm text-muted-foreground">Subtype</p>
                      <p className="font-medium">{cancerData.subtype}</p>
                    </div>
                  )}
                  {cancerData.stage && (
                    <div>
                      <p className="text-sm text-muted-foreground">Stage</p>
                      <p className="font-medium">Stage {cancerData.stage}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Diagnosis Date</p>
                    <p className="font-medium">{new Date(cancerData.diagnosisDate).toLocaleDateString()}</p>
                  </div>
                </div>
                {cancerData.biomarkers && cancerData.biomarkers.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Biomarkers</p>
                      <div className="flex flex-wrap gap-2">
                        {cancerData.biomarkers.map((bm, i) => (
                          <Badge 
                            key={i} 
                            variant={bm.status === "positive" ? "default" : bm.status === "negative" ? "secondary" : "outline"}
                          >
                            {bm.name}: {bm.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Current Treatment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ongoingTreatments.length > 0 ? (
                  <div className="space-y-3">
                    {ongoingTreatments.map((treatment) => {
                      const Icon = treatmentIcons[treatment.treatmentType];
                      return (
                        <div key={treatment.id} className="flex items-start gap-3 p-3 rounded-lg border">
                          <Icon className="h-5 w-5 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{treatment.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Started {new Date(treatment.startDate).toLocaleDateString()}
                            </p>
                            {treatment.provider && (
                              <p className="text-sm text-muted-foreground">
                                Provider: {treatment.provider}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-green-600">
                            Ongoing
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No active treatments
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-amber-500" />
                Document Folders
              </CardTitle>
              <CardDescription>Quick access to your organized cancer documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cancerFolderTypes.map((folder) => {
                  const Icon = folderIcons[folder] || FileText;
                  const count = folderCounts?.[folder] || 0;
                  return (
                    <Button
                      key={folder}
                      variant="outline"
                      className="h-auto py-4 flex-col gap-2 hover-elevate"
                      onClick={() => {
                        setSelectedFolder(folder);
                        setActiveTab("documents");
                      }}
                      data-testid={`folder-${folder}`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-xs text-center">{cancerFolderLabels[folder]}</span>
                      {count > 0 && (
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Treatment Timeline
              </CardTitle>
              <CardDescription>Your complete cancer treatment history</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTimeline ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {timeline.map((entry, index) => {
                      const Icon = treatmentIcons[entry.treatmentType];
                      return (
                        <div key={entry.id} className="relative pl-10">
                          <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-background" />
                          </div>
                          <Card className="hover-elevate">
                            <CardContent className="py-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    <Icon className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{entry.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {treatmentTypeLabels[entry.treatmentType]}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(entry.startDate).toLocaleDateString()}
                                      {entry.endDate && ` - ${new Date(entry.endDate).toLocaleDateString()}`}
                                      {entry.isOngoing && " - Ongoing"}
                                    </div>
                                    {entry.facility && (
                                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                        <Building2 className="h-3 w-3" />
                                        {entry.facility}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant={entry.isOngoing ? "default" : "secondary"}>
                                  {entry.isOngoing ? "Ongoing" : "Completed"}
                                </Badge>
                              </div>
                              
                              {entry.details && (
                                <div className="mt-3 pt-3 border-t">
                                  {entry.details.drugs && entry.details.drugs.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {entry.details.drugs.map((drug, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {drug}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {entry.details.cycleNumber && (
                                    <p className="text-sm text-muted-foreground">
                                      Cycle {entry.details.cycleNumber} of {entry.details.totalCycles}
                                    </p>
                                  )}
                                  {entry.details.outcome && (
                                    <p className="text-sm mt-1">{entry.details.outcome}</p>
                                  )}
                                </div>
                              )}

                              {entry.sideEffects && entry.sideEffects.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm font-medium mb-2">Side Effects</p>
                                  <div className="flex flex-wrap gap-1">
                                    {entry.sideEffects.map((se, i) => (
                                      <Badge 
                                        key={i} 
                                        variant="outline"
                                        className={
                                          se.severity === "severe" ? "border-red-500 text-red-600 dark:text-red-400 bg-red-500/10" :
                                          se.severity === "moderate" ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10" :
                                          "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10"
                                        }
                                        aria-label={`${se.name}, severity: ${se.severity}${se.isOngoing ? ", ongoing" : ""}`}
                                      >
                                        <span className="capitalize">{se.severity}</span>
                                        <span className="mx-1">-</span>
                                        {se.name}
                                        {se.isOngoing && " (ongoing)"}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {entry.notes && (
                                <p className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                                  {entry.notes}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No treatments recorded yet</p>
                  <Button className="mt-4" onClick={() => setShowAddTreatmentDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Treatment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="md:w-64 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Folders</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  <Button
                    variant={selectedFolder === null ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedFolder(null)}
                    data-testid="button-folder-all"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    All Documents
                    <Badge variant="outline" className="ml-auto">
                      {documents?.length || 0}
                    </Badge>
                  </Button>
                  {cancerFolderTypes.map((folder) => {
                    const Icon = folderIcons[folder] || FileText;
                    const count = folderCounts?.[folder] || 0;
                    return (
                      <Button
                        key={folder}
                        variant={selectedFolder === folder ? "secondary" : "ghost"}
                        className="w-full justify-start text-left"
                        onClick={() => setSelectedFolder(folder)}
                        data-testid={`button-folder-${folder}`}
                      >
                        <Icon className="h-4 w-4 mr-2 shrink-0" />
                        <span className="truncate flex-1">{cancerFolderLabels[folder]}</span>
                        {count > 0 && (
                          <Badge variant="outline" className="ml-2">{count}</Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    {selectedFolder ? cancerFolderLabels[selectedFolder] : "All Documents"}
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc-inline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <button 
                        key={doc.id} 
                        className="flex items-start gap-3 p-3 rounded-lg border hover-elevate cursor-pointer text-left w-full"
                        type="button"
                        data-testid={`button-doc-${doc.id}`}
                      >
                        <div className="p-2 rounded bg-muted">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(doc.documentDate).toLocaleDateString()}
                            {doc.provider && (
                              <>
                                <span className="mx-1">•</span>
                                {doc.provider}
                              </>
                            )}
                          </div>
                          {doc.summary && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {doc.summary}
                            </p>
                          )}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {doc.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No documents in this folder</p>
                    <Button className="mt-4" variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-doc-empty">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-blue-500" />
                  Oncologists
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cancerData.oncologists && cancerData.oncologists.length > 0 ? (
                  <div className="space-y-4">
                    {cancerData.oncologists.map((doc, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{doc.name}</p>
                            {doc.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          {doc.specialty && (
                            <p className="text-sm text-muted-foreground">{doc.specialty}</p>
                          )}
                          {doc.facility && (
                            <p className="text-sm text-muted-foreground">{doc.facility}</p>
                          )}
                          {doc.phone && (
                            <div className="flex items-center gap-1 mt-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {doc.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No oncologists added
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-green-500" />
                  Treatment Centers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cancerData.treatmentCenters && cancerData.treatmentCenters.length > 0 ? (
                  <div className="space-y-4">
                    {cancerData.treatmentCenters.map((center, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <Building2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{center.name}</p>
                            {center.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          {center.address && (
                            <p className="text-sm text-muted-foreground">{center.address}</p>
                          )}
                          {center.phone && (
                            <div className="flex items-center gap-1 mt-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {center.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No treatment centers added
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <UploadDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        cancerId={SAMPLE_CANCER_ID}
        defaultFolder={selectedFolder}
      />

      <AddTreatmentDialog
        open={showAddTreatmentDialog}
        onOpenChange={setShowAddTreatmentDialog}
        cancerId={SAMPLE_CANCER_ID}
      />
    </div>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  cancerId,
  defaultFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancerId: string;
  defaultFolder: CancerFolderType | null;
}) {
  const [isCancerRelated, setIsCancerRelated] = useState<boolean | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<CancerFolderType>(defaultFolder || "other");
  const [title, setTitle] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split("T")[0]);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/cancer-track/${cancerId}/documents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cancer-track", cancerId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cancer-track", cancerId, "folders"] });
      toast({ title: "Document uploaded", description: "Your document has been filed successfully." });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setIsCancerRelated(null);
    setSelectedFolder(defaultFolder || "other");
    setTitle("");
    setDocumentDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a document to your cancer care records
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCancerRelated === null && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Is this document related to your cancer care?</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCancerRelated(true)}
                  data-testid="button-cancer-related-yes"
                >
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Yes, cancer-related
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCancerRelated(false)}
                  data-testid="button-cancer-related-no"
                >
                  No, other medical
                </Button>
              </div>
            </div>
          )}

          {isCancerRelated !== null && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., PET Scan Results - January 2025"
                  data-testid="input-doc-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Document Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  data-testid="input-doc-date"
                />
              </div>

              {isCancerRelated && (
                <div className="space-y-2">
                  <Label htmlFor="folder">File to Folder</Label>
                  <Select value={selectedFolder} onValueChange={(v) => setSelectedFolder(v as CancerFolderType)}>
                    <SelectTrigger data-testid="select-folder">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cancerFolderTypes.map((folder) => (
                        <SelectItem key={folder} value={folder}>
                          {cancerFolderLabels[folder]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG up to 10MB
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-cancel-upload">
            Cancel
          </Button>
          {isCancerRelated !== null && (
            <Button
              onClick={() => {
                uploadMutation.mutate({
                  profileId: "profile-default",
                  folderType: isCancerRelated ? selectedFolder : "other",
                  title: title || "Uploaded Document",
                  fileName: "document.pdf",
                  documentDate,
                  isAutoFiled: false,
                });
              }}
              disabled={uploadMutation.isPending}
              data-testid="button-submit-upload"
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload Document
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTreatmentDialog({
  open,
  onOpenChange,
  cancerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancerId: string;
}) {
  const [treatmentType, setTreatmentType] = useState<TreatmentType>("chemotherapy");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [facility, setFacility] = useState("");
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/cancer-track/${cancerId}/timeline`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cancer-track", cancerId, "timeline"] });
      toast({ title: "Treatment added", description: "Your treatment entry has been saved." });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setTreatmentType("chemotherapy");
    setTitle("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setFacility("");
    setProvider("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Treatment</DialogTitle>
          <DialogDescription>
            Record a treatment to your cancer timeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Treatment Type</Label>
            <Select value={treatmentType} onValueChange={(v) => setTreatmentType(v as TreatmentType)}>
              <SelectTrigger data-testid="select-treatment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {treatmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {treatmentTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., AC-T Chemotherapy Cycle 1"
              data-testid="input-treatment-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-treatment-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facility">Facility (optional)</Label>
            <Input
              id="facility"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder="Treatment center name"
              data-testid="input-treatment-facility"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider (optional)</Label>
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Doctor or nurse name"
              data-testid="input-treatment-provider"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={3}
              data-testid="input-treatment-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-cancel-treatment">
            Cancel
          </Button>
          <Button
            onClick={() => {
              addMutation.mutate({
                profileId: "profile-default",
                treatmentType,
                title: title || treatmentTypeLabels[treatmentType],
                startDate,
                isOngoing: true,
                facility: facility || undefined,
                provider: provider || undefined,
                notes: notes || undefined,
              });
            }}
            disabled={addMutation.isPending || !title}
            data-testid="button-submit-treatment"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Treatment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
