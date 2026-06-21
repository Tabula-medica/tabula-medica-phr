import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, MessageCircleQuestion, HelpCircle, ChevronDown } from "lucide-react";

type RecordType = "lab_result" | "diagnosis" | "procedure" | "medication" | "imaging" | "vital_sign" | "allergy" | "general";

interface ELI12Request {
  term: string;
  context?: string;
  recordType: RecordType;
  value?: string;
  unit?: string;
  referenceRange?: string;
}

interface ELI12Response {
  summary: string;
  whatItMeans: string;
  whatItMeasures?: string;
  commonReasons: string;
  questionsToAsk: string[];
  relatedTerms?: string[];
}

interface ELI12ExplainerProps {
  term: string;
  recordType: RecordType;
  context?: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  variant?: "button" | "icon" | "inline";
  size?: "sm" | "default";
}

export function ELI12Explainer({
  term,
  recordType,
  context,
  value,
  unit,
  referenceRange,
  variant = "button",
  size = "sm",
}: ELI12ExplainerProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<ELI12Response | null>(null);

  const explainMutation = useMutation({
    mutationFn: async (request: ELI12Request) => {
      const response = await apiRequest("POST", "/api/eli12/explain", request);
      return response.json() as Promise<ELI12Response>;
    },
    onSuccess: (data) => {
      setExplanation(data);
      setShowExplanation(true);
    },
  });

  const handleExplain = () => {
    if (explanation) {
      setShowExplanation(!showExplanation);
      return;
    }
    explainMutation.mutate({
      term,
      recordType,
      context,
      value,
      unit,
      referenceRange,
    });
  };

  const isLoading = explainMutation.isPending;

  if (variant === "icon") {
    return (
      <div className="inline-flex flex-col">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExplain}
          disabled={isLoading}
          className="px-1.5 text-blue-500"
          aria-label={`Explain ${term} in plain language`}
          data-testid={`button-eli12-${term.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" />
          )}
        </Button>
        {showExplanation && explanation && (
          <ELI12ExplanationCard explanation={explanation} />
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExplain}
          disabled={isLoading}
          className="px-2 text-xs text-blue-600 dark:text-blue-400"
          aria-label={`Explain ${term} in plain language`}
          data-testid={`button-eli12-inline-${term.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Lightbulb className="h-3 w-3 mr-1" />
          )}
          <span>{showExplanation ? "Hide explanation" : "Explain this"}</span>
        </Button>
        {showExplanation && explanation && (
          <ELI12InlineExplanation explanation={explanation} />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <Button
        variant="outline"
        size={size}
        onClick={handleExplain}
        disabled={isLoading}
        className="gap-1.5 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800"
        aria-label={`Explain ${term} in plain language`}
        data-testid={`button-eli12-${term.replace(/\s+/g, "-").toLowerCase()}`}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5" />
        )}
        <span>{showExplanation ? "Hide" : "Explain"}</span>
      </Button>
      {showExplanation && explanation && (
        <ELI12ExplanationCard explanation={explanation} />
      )}
    </div>
  );
}

function ELI12ExplanationCard({ explanation }: { explanation: ELI12Response }) {
  return (
    <Card className="mt-3 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/30 dark:to-background" data-testid="eli12-explanation-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              In Plain English
            </p>
            <p className="text-sm text-foreground" data-testid="eli12-summary">
              {explanation.summary}
            </p>
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="details" className="border-blue-200 dark:border-blue-800">
            <AccordionTrigger className="text-sm py-2 hover:no-underline text-blue-700 dark:text-blue-300" data-testid="eli12-learn-more">
              <span className="flex items-center gap-2">
                <ChevronDown className="h-3.5 w-3.5" />
                Learn more
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    What this means
                  </h4>
                  <p className="text-sm" data-testid="eli12-what-it-means">{explanation.whatItMeans}</p>
                </div>

                {explanation.whatItMeasures && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      What this test measures
                    </h4>
                    <p className="text-sm" data-testid="eli12-what-it-measures">{explanation.whatItMeasures}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Why this appears in records
                  </h4>
                  <p className="text-sm" data-testid="eli12-common-reasons">{explanation.commonReasons}</p>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <MessageCircleQuestion className="h-3.5 w-3.5" />
                    Questions to ask your doctor
                  </h4>
                  <ul className="space-y-1.5 ml-1" data-testid="eli12-questions">
                    {explanation.questionsToAsk.map((question, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-blue-500 shrink-0">•</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {explanation.relatedTerms && explanation.relatedTerms.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Related terms you might see
                    </h4>
                    <div className="flex flex-wrap gap-1.5" data-testid="eli12-related-terms">
                      {explanation.relatedTerms.map((term, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ELI12InlineExplanation({ explanation }: { explanation: ELI12Response }) {
  return (
    <div className="mt-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 space-y-3" data-testid="eli12-inline-explanation">
      <p className="text-sm text-foreground" data-testid="eli12-inline-summary">
        {explanation.summary}
      </p>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="more" className="border-none">
          <AccordionTrigger className="text-xs py-1 hover:no-underline text-blue-600 dark:text-blue-400" data-testid="eli12-inline-learn-more">
            Learn more
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-1 text-sm">
            <p>{explanation.whatItMeans}</p>
            {explanation.whatItMeasures && (
              <p className="text-muted-foreground">{explanation.whatItMeasures}</p>
            )}
            <div className="pt-1">
              <span className="text-xs font-medium text-muted-foreground">Ask your doctor:</span>
              <ul className="mt-1 space-y-0.5">
                {explanation.questionsToAsk.slice(0, 2).map((q, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {q}</li>
                ))}
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function QuickExplainBadge({ term, abbreviation }: { term: string; abbreviation: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{abbreviation}</span>
      <ELI12Explainer term={term} recordType="general" variant="icon" />
    </span>
  );
}
