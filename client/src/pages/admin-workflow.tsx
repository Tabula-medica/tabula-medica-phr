import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/components/shared/format-helpers";
import { 
  FileText, 
  Calendar, 
  Send, 
  Code, 
  Clock, 
  User, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Building,
  Stethoscope,
  ClipboardList,
  FileCheck,
  ArrowRight,
  Copy,
} from "lucide-react";

interface ClinicalNote {
  id: string;
  date: string;
  provider: string;
  chiefComplaint: string;
  diagnosis: string;
  procedures: string[];
  notes: string;
}

interface CodingSuggestion {
  code: string;
  type: "ICD-10" | "CPT" | "HCPCS";
  description: string;
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
}

interface SchedulingSuggestion {
  appointmentType: string;
  suggestedTimeframe: string;
  priority: "Urgent" | "Routine" | "Follow-up";
  duration: number;
  reasoning: string;
  preferredSpecialty?: string;
}

interface ReferralDraft {
  recipientSpecialty: string;
  urgency: string;
  reasonForReferral: string;
  clinicalSummary: string;
  relevantHistory: string[];
  requestedServices: string[];
  disclaimer: string;
}

interface Provider {
  name: string;
  specialty: string;
  availability: string[];
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    High: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    Low: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <Badge variant="outline" className={colors[confidence] || ""}>
      {confidence}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    Routine: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "Follow-up": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <Badge variant="outline" className={colors[priority] || ""}>
      {priority}
    </Badge>
  );
}

function ClinicalNoteCard({ 
  note, 
  onSelectForCoding,
  onSelectForScheduling,
  onSelectForReferral,
  isProcessing,
}: { 
  note: ClinicalNote;
  onSelectForCoding: () => void;
  onSelectForScheduling: () => void;
  onSelectForReferral: () => void;
  isProcessing: boolean;
}) {
  return (
    <Card className="hover-elevate" data-testid={`note-card-${note.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{note.chiefComplaint}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <User className="h-3 w-3" />
              {note.provider}
              <span className="text-muted-foreground">-</span>
              <Calendar className="h-3 w-3" />
              {formatDate(note.date)}
            </CardDescription>
          </div>
          <Badge variant="secondary">{note.id}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Diagnosis</p>
          <p className="text-sm">{note.diagnosis}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Procedures</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {note.procedures.map((proc, i) => (
              <Badge key={i} variant="outline" className="text-xs">{proc}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onSelectForCoding}
            disabled={isProcessing}
            data-testid={`button-coding-${note.id}`}
          >
            <Code className="h-4 w-4 mr-1" />
            Suggest Codes
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onSelectForScheduling}
            disabled={isProcessing}
            data-testid={`button-scheduling-${note.id}`}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Schedule
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onSelectForReferral}
            disabled={isProcessing}
            data-testid={`button-referral-${note.id}`}
          >
            <Send className="h-4 w-4 mr-1" />
            Draft Referral
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CodingResultsPanel({ 
  suggestions, 
  disclaimer,
  onCopyCode,
}: { 
  suggestions: CodingSuggestion[];
  disclaimer: string;
  onCopyCode: (code: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Administrative Tool</AlertTitle>
        <AlertDescription className="text-sm">{disclaimer}</AlertDescription>
      </Alert>
      
      <div className="space-y-3">
        {suggestions.map((suggestion, i) => (
          <Card key={i} className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="font-mono">{suggestion.code}</Badge>
                    <Badge variant="outline">{suggestion.type}</Badge>
                    <ConfidenceBadge confidence={suggestion.confidence} />
                  </div>
                  <p className="text-sm font-medium">{suggestion.description}</p>
                  <p className="text-sm text-muted-foreground mt-1">{suggestion.reasoning}</p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => onCopyCode(suggestion.code)}
                  data-testid={`button-copy-code-${i}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SchedulingResultsPanel({ 
  suggestions,
  providers,
  disclaimer,
}: { 
  suggestions: SchedulingSuggestion[];
  providers: Provider[];
  disclaimer: string;
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Administrative Tool</AlertTitle>
        <AlertDescription className="text-sm">{disclaimer}</AlertDescription>
      </Alert>
      
      <div className="space-y-3">
        {suggestions.map((suggestion, i) => (
          <Card key={i} className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{suggestion.appointmentType}</Badge>
                    <PriorityBadge priority={suggestion.priority} />
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      {suggestion.duration} min
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    Schedule within: <span className="font-semibold">{suggestion.suggestedTimeframe}</span>
                  </p>
                  {suggestion.preferredSpecialty && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Specialty: {suggestion.preferredSpecialty}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">{suggestion.reasoning}</p>
                </div>
                <Button size="sm" data-testid={`button-schedule-${i}`}>
                  <Calendar className="h-4 w-4 mr-1" />
                  Book
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Available Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {providers.map((provider, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">{provider.specialty}</p>
                </div>
                <p className="text-xs text-muted-foreground">{provider.availability.join(", ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralDraftPanel({ 
  draft,
  referringProvider,
  patientName,
  onCopyDraft,
}: { 
  draft: ReferralDraft;
  referringProvider: string;
  patientName: string;
  onCopyDraft: () => void;
}) {
  const urgencyColors: Record<string, string> = {
    Routine: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    Emergent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Draft Document</AlertTitle>
        <AlertDescription className="text-sm">{draft.disclaimer}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Referral Letter Draft
            </CardTitle>
            <Button size="sm" variant="outline" onClick={onCopyDraft} data-testid="button-copy-referral">
              <Copy className="h-4 w-4 mr-1" />
              Copy Draft
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <Badge variant="outline" className={urgencyColors[draft.urgency] || ""}>
              {draft.urgency}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary">
              <Stethoscope className="h-3 w-3 mr-1" />
              {draft.recipientSpecialty}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Patient</p>
              <p>{patientName}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Referring Provider</p>
              <p>{referringProvider}</p>
            </div>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm mb-1">Reason for Referral</p>
            <p className="text-sm bg-muted/50 p-3 rounded-md">{draft.reasonForReferral}</p>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm mb-1">Clinical Summary</p>
            <p className="text-sm bg-muted/50 p-3 rounded-md">{draft.clinicalSummary}</p>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm mb-1">Relevant History</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {draft.relevantHistory.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-medium text-muted-foreground text-sm mb-1">Requested Services</p>
            <div className="flex flex-wrap gap-1">
              {draft.requestedServices.map((service, i) => (
                <Badge key={i} variant="outline">{service}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminWorkflow() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("coding");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [referralDialogOpen, setReferralDialogOpen] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const [codingResults, setCodingResults] = useState<{
    suggestions: CodingSuggestion[];
    disclaimer: string;
  } | null>(null);

  const [schedulingResults, setSchedulingResults] = useState<{
    suggestions: SchedulingSuggestion[];
    providers: Provider[];
    disclaimer: string;
  } | null>(null);

  const [referralResults, setReferralResults] = useState<{
    draft: ReferralDraft;
    referringProvider: string;
    patientName: string;
  } | null>(null);

  const notesQuery = useQuery<{ success: boolean; data: { notes: ClinicalNote[]; providers: Provider[] } }>({
    queryKey: ["/api/admin-workflow/clinical-notes"],
  });

  const codingMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("POST", "/api/admin-workflow/suggest-codes", { noteId });
      return res.json();
    },
    onSuccess: (data) => {
      setCodingResults({
        suggestions: data.data.suggestions,
        disclaimer: data.data.disclaimer,
      });
      setActiveTab("coding");
      toast({
        title: "Coding suggestions generated",
        description: "AI has analyzed the clinical note and suggested billing codes.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate coding suggestions",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const schedulingMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("POST", "/api/admin-workflow/suggest-scheduling", { noteId });
      return res.json();
    },
    onSuccess: (data) => {
      setSchedulingResults({
        suggestions: data.data.suggestions,
        providers: data.data.availableProviders,
        disclaimer: data.data.disclaimer,
      });
      setActiveTab("scheduling");
      toast({
        title: "Scheduling suggestions generated",
        description: "AI has analyzed the clinical note and suggested follow-up appointments.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate scheduling suggestions",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const referralMutation = useMutation({
    mutationFn: async ({ noteId, targetSpecialty }: { noteId: string; targetSpecialty: string }) => {
      const res = await apiRequest("POST", "/api/admin-workflow/draft-referral", { 
        noteId, 
        targetSpecialty,
        urgency: "Routine",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setReferralResults({
        draft: data.data.draft,
        referringProvider: data.data.referringProvider,
        patientName: data.data.patientName,
      });
      setReferralDialogOpen(false);
      setActiveTab("referral");
      toast({
        title: "Referral draft generated",
        description: "AI has drafted a referral letter for physician review.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate referral draft",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied",
      description: `${code} has been copied to clipboard.`,
    });
  };

  const handleCopyReferral = () => {
    if (referralResults) {
      const text = `
REFERRAL LETTER

To: ${referralResults.draft.recipientSpecialty}
From: ${referralResults.referringProvider}
Patient: ${referralResults.patientName}
Urgency: ${referralResults.draft.urgency}

REASON FOR REFERRAL:
${referralResults.draft.reasonForReferral}

CLINICAL SUMMARY:
${referralResults.draft.clinicalSummary}

RELEVANT HISTORY:
${referralResults.draft.relevantHistory.map(h => `- ${h}`).join("\n")}

REQUESTED SERVICES:
${referralResults.draft.requestedServices.join(", ")}
      `.trim();
      navigator.clipboard.writeText(text);
      toast({
        title: "Referral copied",
        description: "The draft referral letter has been copied to clipboard.",
      });
    }
  };

  const isProcessing = codingMutation.isPending || schedulingMutation.isPending || referralMutation.isPending;

  const notes = notesQuery.data?.data?.notes || [];
  const providers = notesQuery.data?.data?.providers || [];

  const specialties = Array.from(new Set(providers.map(p => p.specialty)));

  if (notesQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (notesQuery.isError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load clinical notes</AlertTitle>
          <AlertDescription>
            Unable to retrieve clinical notes. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Administrative Workflow Automation
          </h1>
          <p className="text-muted-foreground">
            AI-powered tools for medical coding, scheduling, and referral management
          </p>
        </div>
      </div>

      <Alert className="mb-6">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>AI-Powered Administrative Tools</AlertTitle>
        <AlertDescription>
          These tools help streamline administrative tasks. All suggestions require professional review before use.
          This is NOT clinical decision support - these tools assist with billing, scheduling, and documentation only.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clinical Notes
          </h2>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-4 pr-4">
              {notes.map((note) => (
                <ClinicalNoteCard
                  key={note.id}
                  note={note}
                  isProcessing={isProcessing}
                  onSelectForCoding={() => {
                    setSelectedNoteId(note.id);
                    codingMutation.mutate(note.id);
                  }}
                  onSelectForScheduling={() => {
                    setSelectedNoteId(note.id);
                    schedulingMutation.mutate(note.id);
                  }}
                  onSelectForReferral={() => {
                    setSelectedNoteId(note.id);
                    setReferralDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="coding" data-testid="tab-coding">
                <Code className="h-4 w-4 mr-1" />
                Coding
              </TabsTrigger>
              <TabsTrigger value="scheduling" data-testid="tab-scheduling">
                <Calendar className="h-4 w-4 mr-1" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger value="referral" data-testid="tab-referral">
                <Send className="h-4 w-4 mr-1" />
                Referral
              </TabsTrigger>
            </TabsList>

            <TabsContent value="coding" className="mt-4">
              {codingMutation.isPending ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Analyzing clinical note for billing codes...</p>
                  </CardContent>
                </Card>
              ) : codingResults ? (
                <CodingResultsPanel
                  suggestions={codingResults.suggestions}
                  disclaimer={codingResults.disclaimer}
                  onCopyCode={handleCopyCode}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Code className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a clinical note and click "Suggest Codes" to generate billing code suggestions
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="scheduling" className="mt-4">
              {schedulingMutation.isPending ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Analyzing treatment plan for scheduling...</p>
                  </CardContent>
                </Card>
              ) : schedulingResults ? (
                <SchedulingResultsPanel
                  suggestions={schedulingResults.suggestions}
                  providers={schedulingResults.providers}
                  disclaimer={schedulingResults.disclaimer}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a clinical note and click "Schedule" to get AI-powered scheduling suggestions
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="referral" className="mt-4">
              {referralMutation.isPending ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Drafting referral letter...</p>
                  </CardContent>
                </Card>
              ) : referralResults ? (
                <ReferralDraftPanel
                  draft={referralResults.draft}
                  referringProvider={referralResults.referringProvider}
                  patientName={referralResults.patientName}
                  onCopyDraft={handleCopyReferral}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Send className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a clinical note and click "Draft Referral" to generate a referral letter
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={referralDialogOpen} onOpenChange={setReferralDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft Referral Letter</DialogTitle>
            <DialogDescription>
              Select the specialty for the referral. AI will draft a letter based on the clinical note.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Target Specialty</label>
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger data-testid="select-specialty">
                <SelectValue placeholder="Select specialty" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((specialty) => (
                  <SelectItem key={specialty} value={specialty}>
                    {specialty}
                  </SelectItem>
                ))}
                <SelectItem value="Gastroenterology">Gastroenterology</SelectItem>
                <SelectItem value="Neurology">Neurology</SelectItem>
                <SelectItem value="Rheumatology">Rheumatology</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedNoteId && selectedSpecialty) {
                  referralMutation.mutate({ noteId: selectedNoteId, targetSpecialty: selectedSpecialty });
                }
              }}
              disabled={!selectedSpecialty || referralMutation.isPending}
              data-testid="button-create-referral"
            >
              {referralMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Draft
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
