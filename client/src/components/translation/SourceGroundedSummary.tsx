import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  Calendar, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  AlertTriangle,
  Languages,
  Info
} from "lucide-react";

interface SourceDocument {
  name: string;
  date: string;
  source: string;
  id?: string;
}

interface HighlightedSentence {
  original: string;
  translated: string;
  index: number;
}

interface SourceGroundedSummaryProps {
  translatedText: string;
  originalText: string;
  sourceDocument: SourceDocument;
  highlightedSentences: HighlightedSentence[];
  disclaimer: string;
  verifyBanner?: string;
  isHighRisk: boolean;
  targetLanguage: string;
  onViewOriginal?: () => void;
}

export function SourceGroundedSummary({
  translatedText,
  originalText,
  sourceDocument,
  highlightedSentences,
  disclaimer,
  verifyBanner,
  isHighRisk,
  targetLanguage,
  onViewOriginal,
}: SourceGroundedSummaryProps) {
  const [showHighlights, setShowHighlights] = useState(false);
  const [showSideBySide, setShowSideBySide] = useState(isHighRisk);

  return (
    <Card className="w-full" data-testid="card-source-grounded-summary">
      {isHighRisk && verifyBanner && (
        <Alert variant="destructive" className="m-4 mb-0" data-testid="alert-high-risk">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            {verifyBanner}
          </AlertDescription>
        </Alert>
      )}

      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2" data-testid="text-summary-title">
            <Languages className="h-5 w-5" />
            Translated Content
          </CardTitle>
          {isHighRisk && (
            <Badge variant="destructive" data-testid="badge-high-risk">
              Critical Content
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-1" data-testid="text-document-name">
            <FileText className="h-4 w-4" />
            <span className="font-medium">Based on:</span> {sourceDocument.name}
          </div>
          <div className="flex items-center gap-1" data-testid="text-document-date">
            <Calendar className="h-4 w-4" />
            {sourceDocument.date}
          </div>
          <div className="flex items-center gap-1" data-testid="text-document-source">
            <Building2 className="h-4 w-4" />
            {sourceDocument.source}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isHighRisk && showSideBySide ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="container-side-by-side">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Original</div>
              <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap" data-testid="text-original-content">
                {originalText}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Translation ({targetLanguage})</div>
              <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap" data-testid="text-translated-content">
                {translatedText}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted/30 rounded-md" data-testid="text-translation-result">
            <p className="text-base whitespace-pre-wrap">{translatedText}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewOriginal}
            data-testid="button-view-original"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Original
          </Button>

          {isHighRisk && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSideBySide(!showSideBySide)}
              data-testid="button-toggle-side-by-side"
            >
              {showSideBySide ? "Hide Side-by-Side" : "Show Side-by-Side"}
            </Button>
          )}
        </div>

        {highlightedSentences.length > 0 && (
          <Collapsible open={showHighlights} onOpenChange={setShowHighlights}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-highlights">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Sentence-by-Sentence Breakdown
                </span>
                {showHighlights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2" data-testid="container-highlights">
              {highlightedSentences.map((sentence, idx) => (
                <div 
                  key={idx} 
                  className="p-3 border rounded-md space-y-2"
                  data-testid={`container-sentence-${idx}`}
                >
                  <div className="text-xs text-muted-foreground">Original:</div>
                  <div className="text-sm bg-muted/30 p-2 rounded">{sentence.original}</div>
                  <div className="text-xs text-muted-foreground">Translated:</div>
                  <div className="text-sm bg-primary/5 p-2 rounded">{sentence.translated}</div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground italic" data-testid="text-disclaimer">
            {disclaimer}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
