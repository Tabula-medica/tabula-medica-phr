import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  HelpCircle,
  Database,
  Brain,
  FileText,
  Quote,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export interface InsightExplanation {
  insightText: string;
  dataSources: {
    source: string;
    facility?: string;
    dateRecorded?: string;
    dataType: string;
    excerpt: string;
  }[];
  derivationSteps: string[];
  limitations: string[];
}

interface ExplainInsightModalProps {
  insight: string;
  dataSources?: InsightExplanation["dataSources"];
  derivationSteps?: string[];
  compact?: boolean;
  className?: string;
}

export function ExplainInsightModal({
  insight,
  dataSources = [],
  derivationSteps = [],
  compact = false,
}: ExplainInsightModalProps) {
  const [open, setOpen] = useState(false);

  const defaultDerivationSteps = [
    "Your health records from connected facilities were securely retrieved",
    "The AI identified key data points relevant to this observation",
    "Direct quotes from your records were extracted to support the insight",
    "The observation was formatted with citations for transparency",
  ];

  const limitations = [
    "This AI cannot diagnose conditions or recommend treatments",
    "Observations are based only on available digitized records",
    "Some records may not be included if not connected to the platform",
    "Medical terminology explanations are educational, not clinical advice",
  ];

  const stepsToShow = derivationSteps.length > 0 ? derivationSteps : defaultDerivationSteps;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "sm" : "default"}
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-explain-insight"
        >
          <HelpCircle className="h-4 w-4" />
          {!compact && "Explain This Insight"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh]" data-testid="modal-explain-insight">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            How This Insight Was Derived
          </DialogTitle>
          <DialogDescription>
            Understanding where this information comes from
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                The Insight
              </h4>
              <div className="p-3 rounded-md bg-muted/50 text-sm" data-testid="text-insight-content">
                {insight}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Data Sources Used
              </h4>
              {dataSources.length > 0 ? (
                <div className="space-y-3">
                  {dataSources.map((source, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-md border bg-card"
                      data-testid={`data-source-${idx}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-xs">
                          {source.dataType}
                        </Badge>
                        {source.facility && (
                          <span className="text-xs text-muted-foreground">
                            {source.facility}
                          </span>
                        )}
                        {source.dateRecorded && (
                          <span className="text-xs text-muted-foreground">
                            {source.dateRecorded}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <Quote className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm italic" data-testid={`quote-${idx}`}>
                          "{source.excerpt}"
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Source: {source.source}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-md bg-muted/30 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Quote className="h-4 w-4" />
                    This insight was derived from your connected health records.
                    Specific citations are included in the insight text using
                    quote-first format: "[Facility] Record states: '[quote]'"
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                How It Was Derived
              </h4>
              <div className="space-y-2">
                {stepsToShow.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3" data-testid={`step-${idx}`}>
                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Limitations
              </h4>
              <ul className="space-y-2">
                {limitations.map((limitation, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Informational Purposes Only
                  </h5>
                  <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="text-disclaimer">
                    This AI-generated insight is provided for informational and educational
                    purposes only. It does not constitute medical advice, diagnosis, or
                    treatment recommendations. The AI quotes directly from your health
                    records and explains medical terminology but does not interpret results
                    as good, bad, normal, or abnormal. Always consult with your healthcare
                    provider for personalized medical guidance.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                This platform follows NO-CDS (No Clinical Decision Support) compliance
                standards for patient safety.
              </span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function parseInsightSources(summaryText: string): InsightExplanation["dataSources"] {
  const sources: InsightExplanation["dataSources"] = [];
  const quotePattern = /\[([^\]]+)\]\s*(?:Record states|shows|indicates|lists|records):\s*["']([^"']+)["']/gi;
  
  let match;
  while ((match = quotePattern.exec(summaryText)) !== null) {
    sources.push({
      source: "Health Record",
      facility: match[1],
      dataType: "Clinical Note",
      excerpt: match[2],
    });
  }
  
  return sources;
}
