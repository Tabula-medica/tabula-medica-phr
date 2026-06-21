import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  Search,
  Link2,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCw,
  Calendar,
  GitCompare,
  AlertCircle,
  Info,
  Send,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";

interface Document {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
}

interface Connection {
  type: string;
  description: string;
  documentIds: string[];
  confidence: number;
  clinicalRelevance: "high" | "medium" | "low";
}

interface Discrepancy {
  type: string;
  description: string;
  documentIds: string[];
  severity: "critical" | "warning" | "info";
  recommendation: string;
}

interface TimelineEvent {
  date: string;
  event: string;
  documentId: string;
  documentTitle: string;
  category: string;
}

interface CrossReferenceResult {
  documents: Array<{ id: string; title: string; category: string }>;
  connections: Connection[];
  discrepancies: Discrepancy[];
  timeline: TimelineEvent[];
  summary: string;
}

interface QAResult {
  answer: string;
  sourcedFrom: Array<{
    documentId: string;
    documentTitle: string;
    relevantExcerpt: string;
    confidence: number;
  }>;
  relatedQuestions: string[];
  disclaimer: string;
}

interface ComparisonResult {
  document1: { id: string; title: string; category: string };
  document2: { id: string; title: string; category: string };
  comparison: {
    similarities: string[];
    differences: string[];
    progressions: string[];
    concerns: string[];
  };
  summary: string;
  disclaimer: string;
}

const categoryLabels: Record<string, string> = {
  labs: "Labs",
  imaging: "Imaging",
  medications: "Medications",
  diagnosis_pathology: "Diagnosis",
  treatment: "Treatment",
  follow_ups: "Follow-ups",
  general_medical: "General",
};

const severityColors = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const relevanceColors = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

export default function DocumentAnalysis() {
  const { toast } = useToast();
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [compareDoc1, setCompareDoc1] = useState<string | null>(null);
  const [compareDoc2, setCompareDoc2] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("crossref");

  const { data: documentsData, isLoading: documentsLoading } = useQuery<{ documents: Document[] }>({
    queryKey: ["/api/documents/enhanced"],
  });

  const documents = documentsData?.documents || [];

  const crossRefMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const response = await apiRequest("POST", "/api/documents/enhanced/cross-reference", { documentIds });
      return response.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze documents", variant: "destructive" });
    },
  });

  const askMutation = useMutation({
    mutationFn: async ({ question, documentIds }: { question: string; documentIds?: string[] }) => {
      const response = await apiRequest("POST", "/api/documents/enhanced/ask", { question, documentIds });
      return response.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to answer question", variant: "destructive" });
    },
  });

  const compareMutation = useMutation({
    mutationFn: async ({ documentId1, documentId2 }: { documentId1: string; documentId2: string }) => {
      const response = await apiRequest("POST", "/api/documents/enhanced/compare", { documentId1, documentId2 });
      return response.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to compare documents", variant: "destructive" });
    },
  });

  const handleToggleDocument = (docId: string) => {
    const newSelection = new Set(selectedDocs);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocs(newSelection);
  };

  const handleCrossReference = () => {
    if (selectedDocs.size < 2) {
      toast({ title: "Select documents", description: "Select at least 2 documents to cross-reference", variant: "destructive" });
      return;
    }
    crossRefMutation.mutate(Array.from(selectedDocs));
  };

  const handleAskQuestion = () => {
    if (!question.trim()) {
      toast({ title: "Enter a question", description: "Please type a question to ask", variant: "destructive" });
      return;
    }
    const docIds = selectedDocs.size > 0 ? Array.from(selectedDocs) : undefined;
    askMutation.mutate({ question, documentIds: docIds });
  };

  const handleCompare = () => {
    if (!compareDoc1 || !compareDoc2) {
      toast({ title: "Select documents", description: "Select 2 documents to compare", variant: "destructive" });
      return;
    }
    compareMutation.mutate({ documentId1: compareDoc1, documentId2: compareDoc2 });
  };

  const crossRefResult = crossRefMutation.data?.result as CrossReferenceResult | undefined;
  const qaResult = askMutation.data?.result as QAResult | undefined;
  const comparisonResult = compareMutation.data as ComparisonResult | undefined;

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/enhanced-documents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Document Analysis
          </h1>
          <p className="text-muted-foreground">Cross-reference, compare, and ask questions about your health records</p>
        </div>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Informational Tool</AlertTitle>
        <AlertDescription>
          This analysis helps you understand your health records. It is NOT medical advice. 
          Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Select Documents
            </CardTitle>
            <CardDescription>
              Choose documents to analyze ({selectedDocs.size} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No documents found</p>
                <Link href="/enhanced-documents">
                  <Button variant="ghost" size="sm">Upload documents</Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedDocs.has(doc.id) 
                          ? "bg-primary/10 border-primary" 
                          : "hover-elevate"
                      }`}
                      onClick={() => handleToggleDocument(doc.id)}
                      data-testid={`doc-select-${doc.id}`}
                    >
                      <Checkbox 
                        checked={selectedDocs.has(doc.id)} 
                        onCheckedChange={() => handleToggleDocument(doc.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[doc.category] || doc.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(doc.updatedAt), "MMM d")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDocs(new Set(documents.map(d => d.id)))}
              data-testid="button-select-all"
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDocs(new Set())}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </CardFooter>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="crossref" data-testid="tab-crossref">
                <Link2 className="h-4 w-4 mr-2" />
                Cross-Reference
              </TabsTrigger>
              <TabsTrigger value="ask" data-testid="tab-ask">
                <MessageSquare className="h-4 w-4 mr-2" />
                Ask Questions
              </TabsTrigger>
              <TabsTrigger value="compare" data-testid="tab-compare">
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </TabsTrigger>
            </TabsList>

            <TabsContent value="crossref" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cross-Reference Analysis</CardTitle>
                  <CardDescription>
                    Find connections, discrepancies, and timelines across your documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleCrossReference} 
                    disabled={selectedDocs.size < 2 || crossRefMutation.isPending}
                    className="w-full"
                    data-testid="button-cross-reference"
                  >
                    {crossRefMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analyze {selectedDocs.size} Documents
                  </Button>
                </CardContent>
              </Card>

              {crossRefResult && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{crossRefResult.summary}</p>
                    </CardContent>
                  </Card>

                  {crossRefResult.discrepancies.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Potential Discrepancies ({crossRefResult.discrepancies.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {crossRefResult.discrepancies.map((disc, i) => (
                          <div key={i} className="p-3 rounded-md border">
                            <div className="flex items-start gap-2">
                              <Badge className={severityColors[disc.severity]}>
                                {disc.severity}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{disc.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Lightbulb className="h-3 w-3 inline mr-1" />
                                  {disc.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {crossRefResult.connections.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-blue-500" />
                          Connections Found ({crossRefResult.connections.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {crossRefResult.connections.map((conn, i) => (
                          <div key={i} className="p-3 rounded-md border">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm flex-1">{conn.description}</p>
                              <Badge className={relevanceColors[conn.clinicalRelevance]}>
                                {conn.clinicalRelevance}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Type: {conn.type.replace(/_/g, " ")} | Confidence: {Math.round(conn.confidence * 100)}%
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {crossRefResult.timeline.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          Timeline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                          <div className="space-y-4">
                            {crossRefResult.timeline.map((event, i) => (
                              <div key={i} className="relative pl-8">
                                <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(event.date), "MMM d, yyyy")}
                                  </p>
                                  <p className="text-sm font-medium">{event.event}</p>
                                  <p className="text-xs text-muted-foreground">
                                    From: {event.documentTitle}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="ask" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ask About Your Documents</CardTitle>
                  <CardDescription>
                    Get answers based on information in your health records
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="e.g., What medications am I currently taking? What were my latest lab results? Are there any follow-up appointments I should schedule?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="min-h-20"
                      data-testid="input-question"
                    />
                  </div>
                  <Button 
                    onClick={handleAskQuestion} 
                    disabled={!question.trim() || askMutation.isPending}
                    className="w-full"
                    data-testid="button-ask"
                  >
                    {askMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Ask Question
                  </Button>
                  {selectedDocs.size > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Searching in {selectedDocs.size} selected document(s)
                    </p>
                  )}
                </CardContent>
              </Card>

              {qaResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      Answer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm whitespace-pre-wrap">{qaResult.answer}</p>
                    
                    {qaResult.sourcedFrom.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Sources:</p>
                        <div className="space-y-2">
                          {qaResult.sourcedFrom.map((source, i) => (
                            <div key={i} className="p-2 rounded-md bg-muted/50 text-sm">
                              <p className="font-medium">{source.documentTitle}</p>
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                "{source.relevantExcerpt}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {qaResult.relatedQuestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Related questions:</p>
                        <div className="flex flex-wrap gap-2">
                          {qaResult.relatedQuestions.map((q, i) => (
                            <Button 
                              key={i} 
                              variant="outline" 
                              size="sm"
                              onClick={() => setQuestion(q)}
                              className="text-xs"
                            >
                              {q}
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {qaResult.disclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="compare" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Compare Two Documents</CardTitle>
                  <CardDescription>
                    Compare findings between reports (e.g., lab results over time)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Document 1</p>
                      <ScrollArea className="h-32 border rounded-md p-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className={`p-2 rounded cursor-pointer text-sm ${
                              compareDoc1 === doc.id ? "bg-primary/20" : "hover-elevate"
                            }`}
                            onClick={() => setCompareDoc1(doc.id)}
                            data-testid={`compare-doc1-${doc.id}`}
                          >
                            {doc.title}
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Document 2</p>
                      <ScrollArea className="h-32 border rounded-md p-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className={`p-2 rounded cursor-pointer text-sm ${
                              compareDoc2 === doc.id ? "bg-primary/20" : "hover-elevate"
                            }`}
                            onClick={() => setCompareDoc2(doc.id)}
                            data-testid={`compare-doc2-${doc.id}`}
                          >
                            {doc.title}
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCompare} 
                    disabled={!compareDoc1 || !compareDoc2 || compareDoc1 === compareDoc2 || compareMutation.isPending}
                    className="w-full"
                    data-testid="button-compare"
                  >
                    {compareMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <GitCompare className="h-4 w-4 mr-2" />
                    )}
                    Compare Documents
                  </Button>
                </CardContent>
              </Card>

              {comparisonResult && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Comparison Results</CardTitle>
                    <CardDescription>
                      {comparisonResult.document1.title} vs {comparisonResult.document2.title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{comparisonResult.summary}</p>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {comparisonResult.comparison.similarities.length > 0 && (
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Similarities
                          </p>
                          <ul className="text-sm space-y-1">
                            {comparisonResult.comparison.similarities.map((s, i) => (
                              <li key={i} className="text-muted-foreground">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {comparisonResult.comparison.differences.length > 0 && (
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2 mb-2">
                            <ArrowRight className="h-4 w-4 text-blue-500" />
                            Differences
                          </p>
                          <ul className="text-sm space-y-1">
                            {comparisonResult.comparison.differences.map((d, i) => (
                              <li key={i} className="text-muted-foreground">• {d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {comparisonResult.comparison.progressions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-purple-500" />
                            Progressions
                          </p>
                          <ul className="text-sm space-y-1">
                            {comparisonResult.comparison.progressions.map((p, i) => (
                              <li key={i} className="text-muted-foreground">• {p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {comparisonResult.comparison.concerns.length > 0 && (
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Concerns
                          </p>
                          <ul className="text-sm space-y-1">
                            {comparisonResult.comparison.concerns.map((c, i) => (
                              <li key={i} className="text-muted-foreground">• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {comparisonResult.disclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
