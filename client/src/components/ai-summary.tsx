import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  Info,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Flag,
  Check,
  ExternalLink,
  Quote,
  Calendar,
  Building2,
  Hash,
  Shield,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react";

interface SourceCitation {
  id: string;
  resourceType: string;
  resourceId: string;
  date: string;
  facility?: string;
  provider?: string;
  snippet: string;
  loincCode?: string;
  fhirReference?: string;
}

interface AISummaryProps {
  title: string;
  summary: string;
  citations: SourceCitation[];
  generatedAt: string;
  modelVersion?: string;
  summaryType: "health" | "medication" | "lab" | "condition" | "visit";
  patientId?: string;
  onFeedback?: (feedback: "helpful" | "not_helpful" | "error") => void;
}

function SourceCitationCard({ citation, index }: { citation: SourceCitation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Card className="text-sm" data-testid={`citation-${citation.id}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            [{index + 1}]
          </Badge>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                {citation.resourceType}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(citation.date).toLocaleDateString()}
              </span>
              {citation.facility && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {citation.facility}
                </span>
              )}
            </div>
            
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <div className="flex items-start gap-2">
                <Quote className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                <p className={`text-muted-foreground italic ${expanded ? "" : "line-clamp-2"}`}>
                  "{citation.snippet}"
                </p>
              </div>
              
              {citation.snippet.length > 100 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-xs mt-1">
                    {expanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show more
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </Collapsible>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {citation.loincCode && (
                <span className="font-mono">LOINC: {citation.loincCode}</span>
              )}
              {citation.fhirReference && (
                <span className="font-mono">ID: {citation.resourceId}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WhatThisIsDisclosure({ summaryType }: { summaryType: AISummaryProps["summaryType"] }) {
  const [open, setOpen] = useState(false);
  
  const disclosures: Record<typeof summaryType, { is: string[]; isNot: string[] }> = {
    health: {
      is: [
        "An AI-generated summary of your health records",
        "Based on structured data from your connected health sources",
        "Designed to help you understand your health information",
        "Reviewed against source records shown below",
      ],
      isNot: [
        "Medical advice or a diagnosis",
        "A substitute for consulting with your healthcare provider",
        "100% accurate - AI may misinterpret medical terminology",
        "A complete picture - only includes data from connected sources",
      ],
    },
    medication: {
      is: [
        "A summary of medications found in your records",
        "Based on prescription and medication administration data",
        "Helpful for sharing with new providers",
      ],
      isNot: [
        "A complete medication list",
        "A substitute for your pharmacy records",
        "Medical advice about your medications",
      ],
    },
    lab: {
      is: [
        "A summary of your lab results",
        "Based on laboratory reports in your records",
        "Helpful for tracking health trends",
      ],
      isNot: [
        "Medical interpretation of your results",
        "A diagnosis or treatment recommendation",
        "A substitute for discussing results with your doctor",
      ],
    },
    condition: {
      is: [
        "A summary of conditions recorded in your health records",
        "Based on diagnosis codes and clinical notes",
        "Useful for understanding your health history",
      ],
      isNot: [
        "A current diagnosis",
        "Medical advice about treatment",
        "A complete list of all health conditions",
      ],
    },
    visit: {
      is: [
        "A summary of your healthcare visits",
        "Based on encounter records from providers",
        "Helpful for tracking your care history",
      ],
      isNot: [
        "A complete record of all visits",
        "Medical advice",
        "A substitute for your provider's notes",
      ],
    },
  };

  const content = disclosures[summaryType];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" data-testid="button-disclosure">
          <Info className="h-3 w-3" />
          What this is / isn't
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Alert className="mt-3">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">About This AI Summary</AlertTitle>
          <AlertDescription>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  This summary IS:
                </p>
                <ul className="text-xs space-y-1">
                  {content.is.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  This summary is NOT:
                </p>
                <ul className="text-xs space-y-1">
                  {content.isNot.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReportErrorDialog({ 
  summaryId, 
  onSubmit 
}: { 
  summaryId?: string; 
  onSubmit: (description: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(description);
    setSubmitting(false);
    setOpen(false);
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-destructive" data-testid="button-report-error">
          <Flag className="h-3 w-3" />
          Report an error
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report an Error in AI Summary
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting inaccuracies in this AI-generated summary. 
            Your feedback is reviewed by our quality assurance team.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="error-description">What's incorrect?</Label>
            <Textarea
              id="error-description"
              placeholder="Please describe the error you noticed. For example: 'The summary says I have diabetes, but I don't have this condition.'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              data-testid="textarea-error-description"
            />
          </div>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle className="text-sm">Your feedback matters</AlertTitle>
            <AlertDescription className="text-xs">
              Reports are logged for QA review and help improve AI accuracy. 
              No personal health information is shared outside your care team.
            </AlertDescription>
          </Alert>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!description.trim() || submitting}
            className="gap-1.5"
            data-testid="button-submit-report"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flag className="h-4 w-4" />
            )}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AISummary({
  title,
  summary,
  citations,
  generatedAt,
  modelVersion,
  summaryType,
  patientId,
  onFeedback,
}: AISummaryProps) {
  const { toast } = useToast();
  const [showCitations, setShowCitations] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "not_helpful" | null>(null);

  const reportErrorMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", "/api/ai-feedback/report-error", {
        patientId,
        summaryType,
        description,
        generatedAt,
        citations: citations.map(c => c.id),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for helping us improve. Our team will review this.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFeedback = (type: "helpful" | "not_helpful") => {
    setFeedbackGiven(type);
    onFeedback?.(type);
    toast({
      title: "Thank you!",
      description: "Your feedback helps us improve.",
    });
  };

  return (
    <Card className="relative" data-testid="ai-summary-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">
                AI-generated summary • {new Date(generatedAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI Summary
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Summary */}
        <div className="prose prose-sm max-w-none">
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
        
        <Separator />
        
        {/* Source Citations */}
        <Collapsible open={showCitations} onOpenChange={setShowCitations}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-1.5" data-testid="button-show-sources">
              <FileText className="h-4 w-4" />
              Source Records ({citations.length})
              {showCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                This summary is based on the following records from your health history:
              </p>
              {citations.map((citation, index) => (
                <SourceCitationCard key={citation.id} citation={citation} index={index} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        <Separator />
        
        {/* Disclosure and Error Reporting */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <WhatThisIsDisclosure summaryType={summaryType} />
          <ReportErrorDialog 
            summaryId={`${summaryType}-${generatedAt}`}
            onSubmit={(desc) => reportErrorMutation.mutate(desc)}
          />
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-muted-foreground">
            Was this summary helpful?
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant={feedbackGiven === "helpful" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleFeedback("helpful")}
              disabled={feedbackGiven !== null}
              className="gap-1 h-7"
              data-testid="button-helpful"
            >
              <ThumbsUp className="h-3 w-3" />
              Helpful
            </Button>
            <Button
              variant={feedbackGiven === "not_helpful" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleFeedback("not_helpful")}
              disabled={feedbackGiven !== null}
              className="gap-1 h-7"
              data-testid="button-not-helpful"
            >
              <ThumbsDown className="h-3 w-3" />
              Not helpful
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// Wrapper for health summary with AI generation
export function AIHealthSummary({ patientId }: { patientId?: string }) {
  // Mock data - in production this would come from API
  const mockSummary: AISummaryProps = {
    title: "Your Health Summary",
    summary: "Based on your recent health records, you have been managing Type 2 Diabetes with good glucose control (HbA1c: 6.8% as of January 2024). Your blood pressure has been within normal range (avg. 128/82 mmHg). Recent labs show normal kidney function and cholesterol levels are well-controlled with current statin therapy. You're up to date on annual flu vaccination and had a routine wellness visit in December 2023.",
    citations: [
      {
        id: "cite-1",
        resourceType: "Observation",
        resourceId: "obs-hba1c-2024",
        date: "2024-01-15",
        facility: "Metro Health Center",
        provider: "Dr. Smith",
        snippet: "HbA1c result: 6.8%. Patient shows good glycemic control. Continue current diabetes management plan.",
        loincCode: "4548-4",
        fhirReference: "Observation/obs-hba1c-2024",
      },
      {
        id: "cite-2",
        resourceType: "Observation",
        resourceId: "obs-bp-2024",
        date: "2024-01-15",
        facility: "Metro Health Center",
        snippet: "Blood pressure: 128/82 mmHg. Within target range for patient with diabetes.",
        loincCode: "85354-9",
        fhirReference: "Observation/obs-bp-2024",
      },
      {
        id: "cite-3",
        resourceType: "Encounter",
        resourceId: "enc-wellness-2023",
        date: "2023-12-05",
        facility: "Metro Health Center",
        provider: "Dr. Johnson",
        snippet: "Annual wellness visit completed. Patient reports feeling well, good medication adherence. Discussed lifestyle modifications for continued diabetes management.",
        fhirReference: "Encounter/enc-wellness-2023",
      },
    ],
    generatedAt: new Date().toISOString(),
    modelVersion: "gemini-2.5-flash",
    summaryType: "health",
    patientId,
  };

  return <AISummary {...mockSummary} />;
}
