import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  AlertTriangle, 
  BookOpen, 
  ListChecks, 
  HelpCircle,
  Languages,
  Share2,
  Printer,
  RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DocumentSummary {
  id: string;
  documentId?: string;
  documentType: string;
  documentTitle: string;
  summary: string;
  keyFindings: string[];
  medicalTermsExplained: Array<{ term: string; explanation: string }>;
  actionItems: string[];
  questionsToAsk: string[];
  generatedAt: string;
  language: string;
  readingLevel: string;
}

interface DocumentSummarizerProps {
  documentId?: string;
  documentType: string;
  documentTitle: string;
  documentContent: string;
  patientId: string;
  onSummaryGenerated?: (summary: DocumentSummary) => void;
  compact?: boolean;
}

const languageOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Espa\u00f1ol" },
  { value: "zh", label: "\u4e2d\u6587" },
  { value: "fr", label: "Fran\u00e7ais" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Portugu\u00eas" },
  { value: "ja", label: "\u65e5\u672c\u8a9e" },
  { value: "ko", label: "\ud55c\uad6d\uc5b4" },
  { value: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
  { value: "hi", label: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { value: "ru", label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" }
];

const readingLevelOptions = [
  { value: "simple", label: "Simple (Easiest to understand)", description: "Uses everyday language, no medical terms" },
  { value: "standard", label: "Standard", description: "Clear language with explained medical terms" },
  { value: "detailed", label: "Detailed", description: "Comprehensive with more technical details" }
];

export function DocumentSummarizer({
  documentId,
  documentType,
  documentTitle,
  documentContent,
  patientId,
  onSummaryGenerated,
  compact = false
}: DocumentSummarizerProps) {
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [language, setLanguage] = useState("en");
  const [readingLevel, setReadingLevel] = useState<"simple" | "standard" | "detailed">("simple");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/documents/summarize", {
        documentId,
        documentType,
        documentTitle,
        documentContent,
        patientId,
        language,
        readingLevel
      });
      return await response.json() as { success: boolean; data: DocumentSummary; fromCache: boolean };
    },
    onSuccess: (data) => {
      setSummary(data.data);
      onSummaryGenerated?.(data.data);
      if (data.fromCache) {
        toast({
          title: "Summary Retrieved",
          description: "Using previously generated summary."
        });
      } else {
        toast({
          title: "Summary Generated",
          description: "Your document has been summarized successfully."
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCopy = async () => {
    if (!summary) return;
    
    const textToCopy = `
${documentTitle} - Summary
Generated: ${new Date(summary.generatedAt).toLocaleDateString()}

SUMMARY:
${summary.summary}

KEY FINDINGS:
${summary.keyFindings.map((f, i) => `${i + 1}. ${f}`).join("\n")}

MEDICAL TERMS EXPLAINED:
${summary.medicalTermsExplained.map(t => `- ${t.term}: ${t.explanation}`).join("\n")}

ACTION ITEMS:
${summary.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}

QUESTIONS TO ASK YOUR DOCTOR:
${summary.questionsToAsk.map((q, i) => `${i + 1}. ${q}`).join("\n")}

---
DISCLAIMER: This summary is for educational purposes only and is not medical advice. Please consult your healthcare provider for personalized guidance.
    `.trim();
    
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Summary copied to clipboard."
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!summary) return;
    
    try {
      await navigator.share({
        title: `${documentTitle} - Summary`,
        text: summary.summary
      });
    } catch {
      handleCopy();
    }
  };

  if (compact && !summary) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => summarizeMutation.mutate()}
        disabled={summarizeMutation.isPending}
        data-testid="button-summarize-compact"
      >
        {summarizeMutation.isPending ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Summarize
      </Button>
    );
  }

  return (
    <Card className="w-full" data-testid="card-document-summarizer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Document Summary
            </CardTitle>
            <CardDescription className="mt-1">
              Get an easy-to-understand summary of your medical document
            </CardDescription>
          </div>
          {!summary && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[130px]" data-testid="select-language">
                  <Languages className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={readingLevel} onValueChange={(v) => setReadingLevel(v as "simple" | "standard" | "detailed")}>
                <SelectTrigger className="w-[150px]" data-testid="select-reading-level">
                  <BookOpen className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {readingLevelOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!summary && !summarizeMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Click below to generate an AI-powered summary of this document
              </p>
              <p className="text-sm text-muted-foreground">
                Document: <span className="font-medium">{documentTitle}</span>
              </p>
            </div>
            <Button
              onClick={() => summarizeMutation.mutate()}
              size="lg"
              data-testid="button-generate-summary"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </div>
        )}

        {summarizeMutation.isPending && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analyzing document and generating summary...</span>
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {summary && (
          <>
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-700 dark:text-amber-400">Educational Information Only</AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-300">
                This summary is for educational purposes only and is NOT medical advice. 
                Always discuss your results with your healthcare provider.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-reading-level">
                  {readingLevelOptions.find(r => r.value === summary.readingLevel)?.label || summary.readingLevel}
                </Badge>
                <Badge variant="outline" data-testid="badge-language">
                  {languageOptions.find(l => l.value === summary.language)?.label || summary.language}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  data-testid="button-copy-summary"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  data-testid="button-share-summary"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrint}
                  data-testid="button-print-summary"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSummary(null);
                  }}
                  data-testid="button-regenerate"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  New Settings
                </Button>
              </div>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <FileText className="h-4 w-4 mr-1" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="findings" data-testid="tab-findings">
                  <ListChecks className="h-4 w-4 mr-1" />
                  Key Points
                </TabsTrigger>
                <TabsTrigger value="terms" data-testid="tab-terms">
                  <BookOpen className="h-4 w-4 mr-1" />
                  Terms
                </TabsTrigger>
                <TabsTrigger value="questions" data-testid="tab-questions">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Questions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-summary">
                    <p className="whitespace-pre-wrap leading-relaxed">{summary.summary}</p>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="findings" className="mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {summary.keyFindings.length > 0 ? (
                      summary.keyFindings.map((finding, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          data-testid={`text-finding-${index}`}
                        >
                          <Badge variant="outline" className="shrink-0 mt-0.5">
                            {index + 1}
                          </Badge>
                          <p className="text-sm">{finding}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No specific key findings identified.</p>
                    )}
                    
                    {summary.actionItems.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <h4 className="font-medium mb-2">Follow-up Items</h4>
                        {summary.actionItems.map((action, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
                            data-testid={`text-action-${index}`}
                          >
                            <ListChecks className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-sm">{action}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="terms" className="mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {summary.medicalTermsExplained.length > 0 ? (
                      summary.medicalTermsExplained.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border"
                          data-testid={`text-term-${index}`}
                        >
                          <h4 className="font-medium text-primary">{item.term}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{item.explanation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No medical terms to explain.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="questions" className="mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Consider asking your healthcare provider these questions at your next visit:
                    </p>
                    {summary.questionsToAsk.length > 0 ? (
                      summary.questionsToAsk.map((question, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          data-testid={`text-question-${index}`}
                        >
                          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm">{question}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No specific questions suggested.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="text-xs text-muted-foreground text-center pt-2">
              Summary generated on {new Date(summary.generatedAt).toLocaleString()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentTermExplainer({
  term,
  context,
  patientId
}: {
  term: string;
  context?: string;
  patientId: string;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const { toast } = useToast();

  const explainMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/documents/explain-term", { term, context, patientId });
      return await response.json() as { success: boolean; data: { term: string; explanation: string; disclaimer: string } };
    },
    onSuccess: (data) => {
      setExplanation(data.data.explanation);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to explain term. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <span className="inline-flex items-center gap-1">
      <span className="underline decoration-dotted decoration-primary cursor-help" data-testid={`term-${term}`}>
        {term}
      </span>
      {explanation ? (
        <span className="text-xs text-muted-foreground ml-1" data-testid={`explanation-${term}`}>
          ({explanation})
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => explainMutation.mutate()}
          disabled={explainMutation.isPending}
          data-testid={`button-explain-${term}`}
        >
          {explainMutation.isPending ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <HelpCircle className="h-3 w-3" />
          )}
        </Button>
      )}
    </span>
  );
}
