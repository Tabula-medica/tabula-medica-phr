import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Quote, 
  Info,
  ExternalLink,
  Clock
} from "lucide-react";

export interface SourceReference {
  id: string;
  type: "record" | "document" | "lab" | "medication" | "note" | "vitals";
  title: string;
  date?: string;
  excerpt?: string;
  recordId?: string;
}

export interface SupportingLine {
  text: string;
  source: SourceReference;
  confidence?: "high" | "medium" | "low";
}

interface AITransparencyProps {
  children: React.ReactNode;
  generatedFrom?: string;
  supportingLines?: SupportingLine[];
  sources?: SourceReference[];
  timestamp?: string;
  showDisclaimer?: boolean;
  compact?: boolean;
  onSourceClick?: (source: SourceReference) => void;
}

export function AITransparency({
  children,
  generatedFrom = "your health records",
  supportingLines = [],
  sources = [],
  timestamp,
  showDisclaimer = true,
  compact = false,
  onSourceClick,
}: AITransparencyProps) {
  const [showSupportingLines, setShowSupportingLines] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const getSourceIcon = (type: SourceReference["type"]) => {
    switch (type) {
      case "record": return <FileText className="h-3 w-3" />;
      case "document": return <FileText className="h-3 w-3" />;
      case "lab": return <FileText className="h-3 w-3" />;
      case "medication": return <FileText className="h-3 w-3" />;
      case "note": return <FileText className="h-3 w-3" />;
      case "vitals": return <FileText className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getConfidenceBadge = (confidence?: "high" | "medium" | "low") => {
    if (!confidence) return null;
    const variants: Record<string, string> = {
      high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <Badge variant="outline" className={`text-xs ${variants[confidence]}`}>
        {confidence} confidence
      </Badge>
    );
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {children}
        {showDisclaimer && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Generated from {generatedFrom}</span>
            {(supportingLines.length > 0 || sources.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={() => setShowSources(!showSources)}
                data-testid="button-show-sources-compact"
              >
                {showSources ? "Hide" : "Show"} sources
              </Button>
            )}
          </div>
        )}
        {showSources && sources.length > 0 && (
          <div className="pl-5 space-y-1">
            {sources.map((source) => (
              <button
                key={source.id}
                className="flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer"
                onClick={() => onSourceClick?.(source)}
                data-testid={`button-source-${source.id}`}
              >
                {getSourceIcon(source.type)}
                <span>{source.title}</span>
                {source.date && <span className="text-muted-foreground">({source.date})</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary/30" data-testid="card-ai-transparency">
      <CardContent className="p-4 space-y-3">
        {showDisclaimer && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span>This summary is generated from {generatedFrom}</span>
            {timestamp && (
              <span className="flex items-center gap-1 ml-auto text-xs">
                <Clock className="h-3 w-3" />
                {timestamp}
              </span>
            )}
          </div>
        )}

        <div className="prose dark:prose-invert max-w-none" data-testid="ai-content">
          {children}
        </div>

        {supportingLines.length > 0 && (
          <Collapsible open={showSupportingLines} onOpenChange={setShowSupportingLines}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between"
                data-testid="button-show-supporting-lines"
              >
                <span className="flex items-center gap-2">
                  <Quote className="h-4 w-4" />
                  Show supporting lines ({supportingLines.length})
                </span>
                {showSupportingLines ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {supportingLines.map((line, index) => (
                <div 
                  key={index} 
                  className="bg-muted/50 rounded-md p-3 border-l-2 border-l-primary/50"
                  data-testid={`supporting-line-${index}`}
                >
                  <div className="flex items-start gap-2">
                    <Quote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm italic">"{line.text}"</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                          onClick={() => onSourceClick?.(line.source)}
                          data-testid={`button-line-source-${index}`}
                        >
                          {getSourceIcon(line.source.type)}
                          <span>{line.source.title}</span>
                          {line.source.date && (
                            <span className="text-muted-foreground">({line.source.date})</span>
                          )}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        {getConfidenceBadge(line.confidence)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {sources.length > 0 && (
          <Collapsible open={showSources} onOpenChange={setShowSources}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between"
                data-testid="button-show-sources"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Show sources ({sources.length})
                </span>
                {showSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="bg-muted/30 rounded-md p-3 space-y-2">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    className="flex items-center gap-2 w-full text-left p-2 rounded hover-elevate cursor-pointer"
                    onClick={() => onSourceClick?.(source)}
                    data-testid={`button-source-${source.id}`}
                  >
                    <div className="p-1.5 rounded bg-primary/10">
                      {getSourceIcon(source.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{source.title}</div>
                      {source.excerpt && (
                        <div className="text-xs text-muted-foreground truncate">{source.excerpt}</div>
                      )}
                    </div>
                    {source.date && (
                      <div className="text-xs text-muted-foreground flex-shrink-0">{source.date}</div>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {supportingLines.length === 0 && sources.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Source details will appear when available from your connected records</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AIDisclaimer({ text = "your health records" }: { text?: string }) {
  return (
    <div 
      className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
      data-testid="ai-disclaimer"
    >
      <Sparkles className="h-3 w-3 text-primary" />
      <span>This summary is generated from {text}</span>
    </div>
  );
}

export function QuoteFirst({ 
  quote, 
  source, 
  interpretation,
  onSourceClick 
}: { 
  quote: string; 
  source: SourceReference; 
  interpretation: string;
  onSourceClick?: (source: SourceReference) => void;
}) {
  return (
    <div className="space-y-2" data-testid="quote-first-block">
      <div className="bg-muted/50 rounded-md p-3 border-l-2 border-l-primary/50">
        <div className="flex items-start gap-2">
          <Quote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm italic flex-1">"{quote}"</p>
        </div>
        <button
          className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline cursor-pointer"
          onClick={() => onSourceClick?.(source)}
          data-testid="button-quote-source"
        >
          <FileText className="h-3 w-3" />
          <span>{source.title}</span>
          {source.date && <span className="text-muted-foreground">({source.date})</span>}
        </button>
      </div>
      <div className="text-sm pl-6">
        <span className="text-muted-foreground">This means: </span>
        {interpretation}
      </div>
    </div>
  );
}
