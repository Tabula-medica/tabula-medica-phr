import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  FileText,
  Stethoscope,
  Pill,
  Calendar,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flag,
  CheckCircle2,
  Building2,
  User,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

interface ClinicalNoteSummary {
  id: string;
  noteId: string;
  chiefComplaint: string | null;
  diagnoses: {
    description: string;
    icdCode?: string;
    confidence: "high" | "medium" | "low";
  }[];
  treatmentPlan: {
    item: string;
    category: "medication" | "procedure" | "lifestyle" | "follow-up" | "other";
  }[];
  followUpInstructions: string[];
  keyFindings: string[];
  medications: {
    name: string;
    dosage?: string;
    instructions?: string;
  }[];
  generatedAt: string;
  modelUsed: string;
  sourceAttribution: {
    noteType: string;
    author?: string;
    facility?: string;
    dateOfService: string;
  };
  disclaimer: string;
  confidenceScore: number;
}

interface ClinicalNoteSummaryProps {
  noteId: string;
  noteContent: string;
  noteType: string;
  author?: string;
  facility?: string;
  dateOfService?: string;
  onSummaryGenerated?: (summary: ClinicalNoteSummary) => void;
}

const CATEGORY_ICONS = {
  medication: Pill,
  procedure: Stethoscope,
  lifestyle: ClipboardList,
  "follow-up": Calendar,
  other: FileText,
};

function ConfidenceBadge({ confidence, score }: { confidence?: "high" | "medium" | "low"; score?: number }) {
  const conf = confidence || (score ? (score >= 85 ? "high" : score >= 70 ? "medium" : "low") : "medium");
  const styles = {
    high: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    low: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  };
  
  return (
    <Badge variant="outline" className={`text-xs ${styles[conf]}`}>
      {score ? `${score}%` : conf} confidence
    </Badge>
  );
}

export function ClinicalNoteSummary({
  noteId,
  noteContent,
  noteType,
  author,
  facility,
  dateOfService,
  onSummaryGenerated,
}: ClinicalNoteSummaryProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<ClinicalNoteSummary | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [errorType, setErrorType] = useState<string>("accuracy");
  const [errorDescription, setErrorDescription] = useState("");
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinical-note-summary/summarize", {
        noteId,
        content: noteContent,
        noteType,
        author,
        facility,
        dateOfService,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setSummary(result.data);
        onSummaryGenerated?.(result.data);
      } else {
        toast({
          title: "Summary Failed",
          description: result.error || "Could not generate summary",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reportErrorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinical-note-summary/report-error", {
        noteId,
        summaryId: summary?.id,
        errorType,
        description: errorDescription,
        suggestedCorrection: suggestedCorrection || undefined,
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Error Reported",
          description: "Thank you for your feedback. Our team will review this report.",
        });
        setReportDialogOpen(false);
        setErrorDescription("");
        setSuggestedCorrection("");
      }
    },
    onError: () => {
      toast({
        title: "Report Failed",
        description: "Could not submit error report. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!summary && !generateMutation.isPending) {
    return (
      <Card className="border-dashed" data-testid="card-generate-summary">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-purple-500/10">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">AI Summary Available</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Generate an AI-powered summary to extract key information like chief complaint, 
                diagnoses, treatment plan, and follow-up instructions.
              </p>
            </div>
            <Button 
              onClick={() => generateMutation.mutate()} 
              className="gap-2"
              data-testid="button-generate-summary"
            >
              <Sparkles className="h-4 w-4" />
              Generate Summary
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (generateMutation.isPending) {
    return (
      <Card data-testid="card-summary-loading">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            <CardTitle className="text-lg">Generating AI Summary...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <>
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5" data-testid="card-ai-summary">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Sparkles className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">AI Summary</CardTitle>
                <CardDescription className="text-xs">
                  Generated {new Date(summary.generatedAt).toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceBadge score={summary.confidenceScore} />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-regenerate"
              >
                <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-toggle-expand"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg flex-wrap">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">{summary.sourceAttribution.noteType}</span>
                {summary.sourceAttribution.author && (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <User className="h-3.5 w-3.5" />
                    <span>{summary.sourceAttribution.author}</span>
                  </>
                )}
                {summary.sourceAttribution.facility && (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{summary.sourceAttribution.facility}</span>
                  </>
                )}
                <Separator orientation="vertical" className="h-3" />
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(summary.sourceAttribution.dateOfService).toLocaleDateString()}</span>
              </div>

              {summary.chiefComplaint && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Chief Complaint
                  </h4>
                  <p className="text-sm text-muted-foreground pl-5">{summary.chiefComplaint}</p>
                </div>
              )}

              {summary.diagnoses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Diagnoses
                  </h4>
                  <div className="space-y-1.5 pl-5">
                    {summary.diagnoses.map((dx, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground flex-1">{dx.description}</span>
                        {dx.icdCode && (
                          <Badge variant="outline" className="text-xs font-mono">{dx.icdCode}</Badge>
                        )}
                        <ConfidenceBadge confidence={dx.confidence} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.medications.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Pill className="h-4 w-4 text-primary" />
                    Medications
                  </h4>
                  <div className="space-y-1.5 pl-5">
                    {summary.medications.map((med, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{med.name}</span>
                        {med.dosage && <span className="text-muted-foreground"> - {med.dosage}</span>}
                        {med.instructions && (
                          <p className="text-xs text-muted-foreground mt-0.5">{med.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.treatmentPlan.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Treatment Plan
                  </h4>
                  <div className="space-y-1.5 pl-5">
                    {summary.treatmentPlan.map((item, idx) => {
                      const Icon = CATEGORY_ICONS[item.category] || FileText;
                      return (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">{item.item}</span>
                          <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {summary.followUpInstructions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    Follow-Up Instructions
                  </h4>
                  <ul className="space-y-1 pl-5">
                    {summary.followUpInstructions.map((instruction, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.keyFindings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    Key Findings
                  </h4>
                  <ul className="space-y-1 pl-5">
                    {summary.keyFindings.map((finding, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Alert className="bg-amber-500/5 border-amber-500/20">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Important Disclaimer
                </AlertTitle>
                <AlertDescription className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  {summary.disclaimer}
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="pt-0 flex justify-between gap-2 flex-wrap border-t border-border/50 mt-2 pt-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setReportDialogOpen(true)}
                    data-testid="button-report-error"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report Error
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Report inaccuracies in this AI summary</p>
                </TooltipContent>
              </Tooltip>
              <span className="text-xs text-muted-foreground">
                Model: {summary.modelUsed}
              </span>
            </CardFooter>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              Report Summary Error
            </DialogTitle>
            <DialogDescription>
              Help us improve AI summaries by reporting inaccuracies or missing information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="error-type">Error Type</Label>
              <Select value={errorType} onValueChange={setErrorType}>
                <SelectTrigger id="error-type" data-testid="select-error-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accuracy">Inaccurate Information</SelectItem>
                  <SelectItem value="missing_info">Missing Information</SelectItem>
                  <SelectItem value="incorrect_extraction">Incorrect Extraction</SelectItem>
                  <SelectItem value="other">Other Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what's incorrect in the summary..."
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                rows={3}
                data-testid="textarea-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction">Suggested Correction (Optional)</Label>
              <Textarea
                id="correction"
                placeholder="What should it say instead?"
                value={suggestedCorrection}
                onChange={(e) => setSuggestedCorrection(e.target.value)}
                rows={2}
                data-testid="textarea-correction"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => reportErrorMutation.mutate()}
              disabled={!errorDescription || reportErrorMutation.isPending}
              className="gap-1.5"
              data-testid="button-submit-report"
            >
              {reportErrorMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ClinicalNoteSummary;
