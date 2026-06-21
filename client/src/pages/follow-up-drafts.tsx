import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Sparkles,
  Send,
  Loader2,
  User,
  FileText,
  Activity,
  Calendar,
  Pill,
  FlaskConical,
  CheckCircle,
  X,
  Edit,
  RefreshCw,
  Heart,
  Target,
  TrendingUp,
  Clock,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdvancedSearchFilter, useAdvancedFilters, defaultFilters, type SearchFilters, type FilterOption } from "@/components/advanced-search-filter";

interface FollowUpDraft {
  id: string;
  patientId: string;
  carePlanId?: string;
  triggerType: "care_plan_progress" | "health_data" | "appointment" | "medication_adherence" | "lab_results";
  subject: string;
  content: string;
  personalizedElements: string[];
  actionItems: string[];
  tone: "encouraging" | "informative" | "reminder" | "congratulatory";
  generatedAt: string;
  status: "draft" | "approved" | "sent" | "discarded";
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface CarePlan {
  id: string;
  patientId: string;
  title: string;
  status: string;
  goals?: any[];
}

const triggerTypeConfig = {
  care_plan_progress: { icon: Target, label: "Care Plan Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  health_data: { icon: Activity, label: "Health Data", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  appointment: { icon: Calendar, label: "Appointment", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100" },
  medication_adherence: { icon: Pill, label: "Medication", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" },
  lab_results: { icon: FlaskConical, label: "Lab Results", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100" },
};

const toneConfig = {
  encouraging: { icon: Heart, label: "Encouraging", color: "text-rose-500" },
  informative: { icon: FileText, label: "Informative", color: "text-blue-500" },
  reminder: { icon: Clock, label: "Reminder", color: "text-orange-500" },
  congratulatory: { icon: ThumbsUp, label: "Congratulatory", color: "text-green-500" },
};

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const },
  approved: { label: "Approved", variant: "default" as const },
  sent: { label: "Sent", variant: "secondary" as const },
  discarded: { label: "Discarded", variant: "destructive" as const },
};

const followUpTypeOptions: FilterOption[] = [
  { id: "care_plan_progress", label: "Care Plan Progress", icon: Target },
  { id: "health_data", label: "Health Data", icon: Activity },
  { id: "appointment", label: "Appointment", icon: Calendar },
  { id: "medication_adherence", label: "Medication", icon: Pill },
  { id: "lab_results", label: "Lab Results", icon: FlaskConical },
];

const followUpToneOptions: FilterOption[] = [
  { id: "encouraging", label: "Encouraging", icon: Heart },
  { id: "informative", label: "Informative", icon: FileText },
  { id: "reminder", label: "Reminder", icon: Clock },
  { id: "congratulatory", label: "Congratulatory", icon: ThumbsUp },
];

export default function FollowUpDrafts() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedDraft, setSelectedDraft] = useState<FollowUpDraft | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "approved" | "sent">("draft");
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const { toast } = useToast();

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const { data: drafts = [], isLoading: loadingDrafts, refetch: refetchDrafts } = useQuery<FollowUpDraft[]>({
    queryKey: ["/api/ai-communication/follow-up-drafts", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const { data: carePlans = [] } = useQuery<CarePlan[]>({
    queryKey: ["/api/care-plans", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const generateDraftMutation = useMutation({
    mutationFn: async (params: { patientId: string; triggerType: FollowUpDraft["triggerType"]; triggerData: any }) => {
      setIsGenerating(true);
      const response = await apiRequest("POST", "/api/ai-communication/follow-up-draft", params);
      return response.json();
    },
    onSuccess: (draft) => {
      setIsGenerating(false);
      refetchDrafts();
      setSelectedDraft(draft);
      setEditedContent(draft.content);
      toast({
        title: "Draft generated",
        description: "AI has created a personalized follow-up message.",
      });
    },
    onError: () => {
      setIsGenerating(false);
      toast({
        title: "Error",
        description: "Failed to generate draft",
        variant: "destructive",
      });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({ draftId, status }: { draftId: string; status: FollowUpDraft["status"] }) => {
      const response = await apiRequest("PATCH", `/api/ai-communication/follow-up-drafts/${draftId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      refetchDrafts();
      toast({
        title: "Draft updated",
        description: "The draft status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update draft",
        variant: "destructive",
      });
    },
  });

  const handleGenerateDraft = (triggerType: FollowUpDraft["triggerType"]) => {
    if (!selectedPatientId) return;
    
    let triggerData: any = {};
    
    if (triggerType === "care_plan_progress" && carePlans.length > 0) {
      const activePlan = carePlans.find(cp => cp.status === "active");
      if (activePlan) {
        triggerData = {
          carePlanId: activePlan.id,
          carePlanTitle: activePlan.title,
          goalProgress: activePlan.goals?.map((g: any) => ({
            description: g.description,
            currentValue: g.currentValue || 0,
            targetValue: g.targetValue || 100,
            status: g.status || "in_progress",
          })) || [],
        };
      }
    } else if (triggerType === "medication_adherence") {
      triggerData = {
        medicationAdherence: {
          medication: "Daily Medications",
          adherenceRate: 85,
          missedDoses: 3,
        },
      };
    } else if (triggerType === "health_data") {
      triggerData = {
        healthData: {
          type: "Blood Pressure",
          value: 125,
          trend: "improving",
          date: new Date().toISOString(),
        },
      };
    } else if (triggerType === "appointment") {
      triggerData = {
        appointmentDetails: {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          provider: "Dr. Smith",
          type: "Follow-up",
        },
      };
    } else if (triggerType === "lab_results") {
      triggerData = {
        labResults: [
          { test: "HbA1c", value: "6.5%", status: "normal", date: new Date().toISOString() },
          { test: "Cholesterol", value: "185 mg/dL", status: "normal", date: new Date().toISOString() },
        ],
      };
    }
    
    generateDraftMutation.mutate({
      patientId: selectedPatientId,
      triggerType,
      triggerData,
    });
  };

  const advancedFilteredDrafts = useAdvancedFilters(
    drafts,
    filters,
    {
      getKeywords: (draft) => [draft.subject, draft.content, ...draft.personalizedElements],
      getDate: (draft) => draft.generatedAt,
      getType: (draft) => draft.triggerType,
      getTags: (draft) => [draft.tone],
    }
  );

  const filteredDrafts = advancedFilteredDrafts.filter(d => 
    statusFilter === "all" || d.status === statusFilter
  );

  const hasActiveFilters = filters.keyword || filters.dateRange.from || filters.dateRange.to || 
    filters.selectedTypes.length > 0 || filters.selectedTags.length > 0;

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Follow-Up Messages
          </h1>
          <p className="text-muted-foreground">
            Generate personalized follow-up messages based on patient progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-[250px]" data-testid="select-patient">
              <SelectValue placeholder="Select a patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedPatientId ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Select a Patient</h3>
            <p className="text-muted-foreground">
              Choose a patient to view and generate AI-powered follow-up messages based on their health data and care plan progress.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Generate New Draft
                </CardTitle>
                <CardDescription>
                  Create personalized messages based on triggers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(triggerTypeConfig).map(([type, config]) => (
                  <Button
                    key={type}
                    variant="outline"
                    className="w-full justify-start gap-2 h-auto py-3"
                    onClick={() => handleGenerateDraft(type as FollowUpDraft["triggerType"])}
                    disabled={isGenerating}
                    data-testid={`button-generate-${type}`}
                  >
                    <config.icon className="h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {type === "care_plan_progress" && "Based on goal achievements"}
                        {type === "health_data" && "Based on vital signs trends"}
                        {type === "appointment" && "Upcoming appointment reminder"}
                        {type === "medication_adherence" && "Adherence encouragement"}
                        {type === "lab_results" && "New lab results summary"}
                      </p>
                    </div>
                    {isGenerating && (
                      <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg">Drafts</CardTitle>
                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="draft" className="text-xs px-2">Draft</TabsTrigger>
                      <TabsTrigger value="approved" className="text-xs px-2">Approved</TabsTrigger>
                      <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="pt-3">
                  <AdvancedSearchFilter
                    placeholder="Search drafts by subject or content..."
                    typeOptions={followUpTypeOptions}
                    tagOptions={followUpToneOptions}
                    showDateFilter={true}
                    showTypeFilter={true}
                    showTagFilter={true}
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                  {hasActiveFilters && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredDrafts.length} filtered result{filteredDrafts.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {loadingDrafts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredDrafts.length === 0 ? (
                    <div className="text-center py-8 px-4 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No drafts yet</p>
                      <p className="text-xs">Generate a new draft above</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredDrafts.map((draft) => {
                        const typeConfig = triggerTypeConfig[draft.triggerType];
                        const ToneIcon = toneConfig[draft.tone].icon;
                        
                        return (
                          <button
                            key={draft.id}
                            onClick={() => {
                              setSelectedDraft(draft);
                              setEditedContent(draft.content);
                            }}
                            className={cn(
                              "w-full text-left p-3 transition-colors hover-elevate",
                              selectedDraft?.id === draft.id && "bg-primary/5"
                            )}
                            data-testid={`draft-${draft.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={cn("p-1.5 rounded", typeConfig.color)}>
                                <typeConfig.icon className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{draft.subject}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {draft.content.substring(0, 60)}...
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={statusConfig[draft.status].variant} className="text-[10px] h-4">
                                    {statusConfig[draft.status].label}
                                  </Badge>
                                  <ToneIcon className={cn("h-3 w-3", toneConfig[draft.tone].color)} />
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(draft.generatedAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedDraft ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={triggerTypeConfig[selectedDraft.triggerType].color}>
                          {triggerTypeConfig[selectedDraft.triggerType].label}
                        </Badge>
                        <Badge variant={statusConfig[selectedDraft.status].variant}>
                          {statusConfig[selectedDraft.status].label}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{selectedDraft.subject}</CardTitle>
                      <CardDescription>
                        To: {selectedPatient?.firstName} {selectedPatient?.lastName}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedDraft.status === "draft" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateDraftMutation.mutate({ draftId: selectedDraft.id, status: "discarded" })}
                            data-testid="button-discard-draft"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Discard
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateDraftMutation.mutate({ draftId: selectedDraft.id, status: "approved" })}
                            data-testid="button-approve-draft"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </>
                      )}
                      {selectedDraft.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            updateDraftMutation.mutate({ draftId: selectedDraft.id, status: "sent" });
                            toast({
                              title: "Message sent",
                              description: `Follow-up sent to ${selectedPatient?.firstName}`,
                            });
                          }}
                          data-testid="button-send-draft"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send Now
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Message Content</label>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[200px] resize-none"
                      disabled={selectedDraft.status !== "draft"}
                      data-testid="textarea-draft-content"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Tone</label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        {(() => {
                          const ToneIcon = toneConfig[selectedDraft.tone].icon;
                          return (
                            <>
                              <ToneIcon className={cn("h-5 w-5", toneConfig[selectedDraft.tone].color)} />
                              <span className="capitalize">{selectedDraft.tone}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Generated</label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span>{format(new Date(selectedDraft.generatedAt), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    </div>
                  </div>

                  {selectedDraft.personalizedElements.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Personalized Elements</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedDraft.personalizedElements.map((element, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {element}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDraft.actionItems.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Action Items for Patient</label>
                      <ul className="space-y-1">
                        {selectedDraft.actionItems.map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                            <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Draft Selected</h3>
                  <p className="text-muted-foreground">
                    Select a draft from the list or generate a new one based on patient triggers.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
