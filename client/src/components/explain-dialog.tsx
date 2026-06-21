import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Info,
  ThumbsUp,
  ThumbsDown,
  Quote,
  ExternalLink,
  MessageCircleQuestion,
  BookOpen,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { ExplanationResponse, ExplainRequest, GuardrailRefusalResponse } from "@shared/schema";

interface ExplainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: string;
  context?: string;
  recordType?: string;
  sourceQuote?: {
    text: string;
    source: string;
    date?: string;
    recordId?: string;
  };
}

interface GenerateResponse {
  guardrailTriggered?: boolean;
  refusal?: GuardrailRefusalResponse;
}

export function ExplainDialog({
  open,
  onOpenChange,
  term,
  context,
  recordType,
  sourceQuote,
}: ExplainDialogProps) {
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [refusal, setRefusal] = useState<GuardrailRefusalResponse | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"yes" | "no" | null>(null);
  const [showSources, setShowSources] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (request: ExplainRequest) => {
      const response = await apiRequest("POST", "/api/explain/generate", request);
      return response.json();
    },
    onSuccess: (data: ExplanationResponse & GenerateResponse) => {
      if (data.guardrailTriggered) {
        const refusalData = data.refusal || {
          id: `fallback-${Date.now()}`,
          triggered: true as const,
          triggerReason: "medical_advice_request" as const,
          detectedPattern: "general",
          originalPrompt: term,
          refusalMessage: "I'm not able to provide medical advice or assess your health situation.",
          clinicianHandoffMessage: "Please speak with your healthcare provider who knows your complete medical history.",
          suggestedActions: [
            "Contact your healthcare provider's office",
            "Visit an urgent care if your doctor is unavailable",
          ],
          timestamp: new Date().toISOString(),
        };
        setRefusal(refusalData);
        setExplanation(null);
        guardrailAnalyticsMutation.mutate({
          eventType: "ai_refusal_shown",
          refusalId: refusalData.id,
          triggerReason: refusalData.triggerReason,
          detectedPattern: refusalData.detectedPattern,
        });
      } else {
        setExplanation(data);
        setRefusal(null);
        analyticsMutation.mutate({ 
          eventType: "explain_generated", 
          term: data.term, 
          explanationId: data.id 
        });
      }
    },
  });

  const analyticsMutation = useMutation({
    mutationFn: async (data: { eventType: string; term?: string; explanationId?: string; metadata?: Record<string, string> }) => {
      await apiRequest("POST", "/api/explain/analytics", data);
    },
  });

  const guardrailAnalyticsMutation = useMutation({
    mutationFn: async (data: { eventType: string; refusalId?: string; triggerReason?: string; detectedPattern?: string }) => {
      await apiRequest("POST", "/api/guardrail/analytics", data);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (data: { explanationId: string; helpful: boolean }) => {
      await apiRequest("POST", "/api/explain/feedback", data);
    },
  });

  useEffect(() => {
    if (open && term) {
      setExplanation(null);
      setRefusal(null);
      setFeedbackGiven(null);
      setShowSources(false);
      
      analyticsMutation.mutate({ eventType: "explain_opened", term });
      
      generateMutation.mutate({
        term,
        context,
        recordType: recordType as any,
        sourceQuote,
      });
    }
  }, [open, term]);

  const handleFeedback = (helpful: boolean) => {
    if (explanation && !feedbackGiven) {
      setFeedbackGiven(helpful ? "yes" : "no");
      feedbackMutation.mutate({ explanationId: explanation.id, helpful });
      analyticsMutation.mutate({
        eventType: helpful ? "explain_feedback_helpful_yes" : "explain_feedback_helpful_no",
        term,
        explanationId: explanation.id,
      });
    }
  };

  const handleViewSources = () => {
    setShowSources(true);
    if (explanation) {
      analyticsMutation.mutate({
        eventType: "explain_viewed_sources",
        term,
        explanationId: explanation.id,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-explain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Understanding "{term}"
          </DialogTitle>
          <DialogDescription>
            Plain-English explanation of this medical term
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {generateMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Generating explanation...</span>
              </div>
            ) : generateMutation.isError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Unable to generate explanation. Please try again.
                </AlertDescription>
              </Alert>
            ) : refusal ? (
              <div className="space-y-4" data-testid="refusal-container">
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    {refusal.refusalMessage}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2 text-primary">
                    <MessageCircleQuestion className="h-4 w-4" />
                    Speak With Your Healthcare Provider
                  </h4>
                  <p className="text-sm text-muted-foreground" data-testid="text-clinician-handoff">
                    {refusal.clinicianHandoffMessage}
                  </p>
                </div>

                {refusal.suggestedActions && refusal.suggestedActions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Suggested Next Steps</h4>
                    <ul className="space-y-1">
                      {refusal.suggestedActions.map((action, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">-</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator />

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This app provides educational information only. It cannot diagnose conditions, 
                    recommend treatments, or assess whether something is serious. Your healthcare 
                    provider can give you personalized medical advice.
                  </AlertDescription>
                </Alert>
              </div>
            ) : explanation ? (
              <>
                {sourceQuote && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Quote className="h-4 w-4" />
                      From Your Record
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 border border-border">
                      <p className="text-sm italic" data-testid="text-source-quote">"{sourceQuote.text}"</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sourceQuote.source}
                        {sourceQuote.date && ` - ${sourceQuote.date}`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    What This Means
                  </h4>
                  <p className="text-sm leading-relaxed" data-testid="text-explanation">
                    {explanation.plainEnglish}
                  </p>
                </div>

                {explanation.questionsForDoctor && explanation.questionsForDoctor.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageCircleQuestion className="h-4 w-4 text-primary" />
                      Questions to Ask Your Doctor
                    </h4>
                    <ul className="space-y-1">
                      {explanation.questionsForDoctor.map((question, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">-</span>
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {explanation.relatedTerms && explanation.relatedTerms.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Related Terms</h4>
                    <div className="flex flex-wrap gap-2">
                      {explanation.relatedTerms.map((relatedTerm, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {relatedTerm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {explanation.sourceQuote && !showSources && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewSources}
                    className="text-xs"
                    data-testid="button-view-sources"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Source Reference
                  </Button>
                )}

                {showSources && explanation.sourceQuote && (
                  <div className="bg-muted/30 rounded-md p-3 space-y-1">
                    <p className="text-xs font-medium">Source Reference</p>
                    <p className="text-xs text-muted-foreground">
                      Type: {explanation.sourceQuote.recordType || "Health Record"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From: {explanation.sourceQuote.source}
                    </p>
                    {explanation.sourceQuote.date && (
                      <p className="text-xs text-muted-foreground">
                        Date: {explanation.sourceQuote.date}
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs text-amber-800 dark:text-amber-200" data-testid="text-disclaimer">
                    {explanation.disclaimer}
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Was this helpful?</span>
                  <div className="flex gap-2">
                    {feedbackGiven ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Thanks for your feedback!
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback(true)}
                          disabled={feedbackMutation.isPending}
                          data-testid="button-feedback-yes"
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Yes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFeedback(false)}
                          disabled={feedbackMutation.isPending}
                          data-testid="button-feedback-no"
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          No
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
