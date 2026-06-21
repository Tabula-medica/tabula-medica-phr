import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  FileText, 
  Search, 
  Download,
  Share2,
  Eye,
  Calendar,
  Building2,
  X,
  File,
  FileImage,
  FileCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BookOpen,
  Loader2,
  Plus,
} from "lucide-react";
import { Link } from "wouter";
import type { Document, EhrConnection, DocumentInsight, DocumentKeyFinding, DocumentActionItem } from "@shared/schema";
import { ehrPlatformInfo } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { TranslateButton } from "@/components/translate-button";
import { DocumentSummarizer } from "@/components/document-summarizer";
import { AdvancedSearchFilter, useAdvancedFilters, defaultFilters, type SearchFilters, type FilterOption } from "@/components/advanced-search-filter";

// Analytics helper for document events
const trackDocumentEvent = async (eventType: "documents_opened" | "document_viewed" | "document_downloaded", metadata?: Record<string, string>) => {
  try {
    await apiRequest("POST", "/api/documents/analytics", { eventType, metadata });
  } catch (error) {
    console.error("[Document Analytics] Failed to track event:", error);
  }
};

interface DocumentWithSource extends Document {
  sourceFacility: string;
  sourcePlatform: string;
}

const documentTypeIcons: Record<string, React.ElementType> = {
  pdf: File,
  ccd: FileCheck,
  lab_report: FileText,
  imaging_report: FileImage,
  clinical_note: FileText,
  discharge_summary: FileText,
};

const documentTypeLabels: Record<string, string> = {
  pdf: "PDF Document",
  ccd: "CCD (Continuity of Care)",
  lab_report: "Lab Report",
  imaging_report: "Imaging Report",
  clinical_note: "Clinical Note",
  discharge_summary: "Discharge Summary",
};

const severityIcons: Record<string, React.ElementType> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const severityColors: Record<string, string> = {
  critical: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  info: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  success: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-400",
};

const trendIcons: Record<string, React.ElementType> = {
  improving: TrendingUp,
  stable: Minus,
  worsening: TrendingDown,
  new: Info,
};

function DocumentCard({ document, onView, onDownload }: { document: DocumentWithSource; onView: (doc: DocumentWithSource) => void; onDownload: (doc: DocumentWithSource) => void }) {
  const Icon = documentTypeIcons[document.type] || FileText;
  const platformData = ehrPlatformInfo[document.sourcePlatform as keyof typeof ehrPlatformInfo];
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Card className="hover-elevate" data-testid={`card-document-${document.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold truncate" data-testid={`text-document-title-${document.id}`}>{document.title}</h4>
              <Badge variant="secondary" data-testid={`badge-document-type-${document.id}`}>{documentTypeLabels[document.type]}</Badge>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {document.description}
            </p>
            
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(document.dateOfService)}</span>
              <span className="text-muted-foreground/50">|</span>
              <Building2 className="h-3.5 w-3.5" />
              <span>{document.sourceFacility}</span>
              <span className="text-muted-foreground/50">|</span>
              <span style={{ color: platformData?.color }}>{platformData?.name || document.sourcePlatform}</span>
              {document.provider && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{document.provider}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(document)}
              data-testid={`button-view-${document.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {(document.type === "discharge_summary" || document.type === "clinical_note") && (
              <TranslateButton
                documentId={document.id}
                documentType="discharge_summary"
                originalTitle={document.title}
                originalContent={document.description || ""}
                variant="outline"
                size="sm"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDownload(document)}
              data-testid={`button-download-${document.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid={`button-share-${document.id}`}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KeyFindingCard({ finding }: { finding: DocumentKeyFinding }) {
  const Icon = severityIcons[finding.severity] || Info;
  const colorClass = severityColors[finding.severity] || severityColors.info;

  return (
    <div className={`p-3 rounded-lg ${colorClass}`} data-testid={`finding-${finding.id}`}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h5 className="font-medium text-sm">{finding.title}</h5>
            <Badge variant="outline" className="text-xs">{finding.category.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-xs opacity-90">{finding.description}</p>
          {finding.value && (
            <p className="text-xs mt-1">
              <span className="font-medium">Value: </span>{finding.value}
              {finding.referenceRange && <span className="opacity-75"> (Reference: {finding.referenceRange})</span>}
            </p>
          )}
          {finding.clinicalSignificance && (
            <p className="text-xs mt-1 opacity-80 italic">{finding.clinicalSignificance}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionItemCard({ item }: { item: DocumentActionItem }) {
  return (
    <div className="p-3 border rounded-lg" data-testid={`action-${item.id}`}>
      <div className="flex items-start gap-3">
        <Badge className={priorityColors[item.priority]}>{item.priority}</Badge>
        <div className="flex-1 min-w-0">
          <h5 className="font-medium text-sm">{item.action}</h5>
          <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
          {item.timeframe && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{item.timeframe}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentInsightsPanel({ 
  document, 
  insights, 
  isLoading, 
  onAnalyze,
  error 
}: { 
  document: DocumentWithSource;
  insights: DocumentInsight | null;
  isLoading: boolean;
  onAnalyze: () => void;
  error?: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Analyzing document with AI...</p>
        <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
        <h4 className="font-semibold mb-2">AI Document Analysis</h4>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Get AI-powered insights including key findings, trends, action items, and plain-language explanations of this document.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}
        <Button onClick={onAnalyze} data-testid="button-analyze-document">
          <Sparkles className="h-4 w-4 mr-2" />
          {error ? "Retry Analysis" : "Analyze Document"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">AI Insights</h4>
        </div>
        <Badge variant="outline" className="text-xs">
          {Math.round(insights.confidenceScore * 100)}% confidence
        </Badge>
      </div>

      <Accordion type="single" collapsible defaultValue="summary" className="w-full">
        <AccordionItem value="summary">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{insights.summary}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="findings">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Key Findings ({insights.keyFindings.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {insights.keyFindings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No significant findings identified.</p>
              ) : (
                insights.keyFindings.map(finding => (
                  <KeyFindingCard key={finding.id} finding={finding} />
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="actions">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Action Items ({insights.actionItems.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {insights.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No action items required.</p>
              ) : (
                insights.actionItems.map(item => (
                  <ActionItemCard key={item.id} item={item} />
                ))
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {insights.trends.length > 0 && (
          <AccordionItem value="trends">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trends ({insights.trends.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {insights.trends.map((trend, i) => {
                  const TrendIcon = trendIcons[trend.direction] || Minus;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <TrendIcon className={`h-4 w-4 mt-0.5 ${
                        trend.direction === 'improving' ? 'text-green-500' :
                        trend.direction === 'worsening' ? 'text-red-500' : 'text-muted-foreground'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{trend.metric}</p>
                        <p className="text-xs text-muted-foreground">{trend.description}</p>
                        {(trend.previousValue || trend.currentValue) && (
                          <p className="text-xs mt-1">
                            {trend.previousValue && <span>{trend.previousValue} </span>}
                            {trend.previousValue && trend.currentValue && <span className="text-muted-foreground">→ </span>}
                            {trend.currentValue && <span className="font-medium">{trend.currentValue}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="explanation">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Plain Language Explanation
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {insights.plainLanguageExplanation}
            </p>
          </AccordionContent>
        </AccordionItem>

        {insights.medicalTermsGlossary.length > 0 && (
          <AccordionItem value="glossary">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Medical Terms Glossary ({insights.medicalTermsGlossary.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {insights.medicalTermsGlossary.map((term, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">{term.term}</p>
                    <p className="text-xs text-muted-foreground">{term.definition}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

function DocumentViewerModal({ document, onClose, onDownload }: { document: DocumentWithSource; onClose: () => void; onDownload: (doc: DocumentWithSource) => void }) {
  const [activeTab, setActiveTab] = useState<string>("content");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  
  // Track document_viewed when modal opens
  useEffect(() => {
    trackDocumentEvent("document_viewed", {
      documentId: document.id,
      documentType: document.type,
      source: document.sourcePlatform,
    });
  }, [document.id, document.type, document.sourcePlatform]);
  
  const { data: cachedInsights, isLoading: isLoadingCached } = useQuery<DocumentInsight>({
    queryKey: ['/api/documents', document.id, 'insights'],
    retry: false,
  });

  const [insights, setInsights] = useState<DocumentInsight | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setAnalyzeError(null);
      const response = await apiRequest("POST", `/api/documents/${document.id}/analyze`, {
        documentType: document.type,
        title: document.title,
        content: document.content || document.description,
        date: document.dateOfService,
        provider: document.provider,
        patientId: document.patientId,
      });
      if (!response.ok) {
        throw new Error("Failed to analyze document");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setInsights(data);
      setActiveTab("insights");
    },
    onError: (error) => {
      setAnalyzeError(error instanceof Error ? error.message : "Analysis failed");
    },
  });

  const displayedInsights = insights || cachedInsights || null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-4xl w-full max-h-[85vh] overflow-hidden animate-in fade-in zoom-in" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap border-b py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{document.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{documentTypeLabels[document.type]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onDownload(document)} data-testid="button-download-doc">
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" data-testid="button-share-doc">
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-viewer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="border-b px-4">
            <TabsList className="h-10">
              <TabsTrigger value="content" className="gap-2" data-testid="tab-content">
                <FileText className="h-4 w-4" />
                Document
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2" data-testid="tab-insights">
                <Sparkles className="h-4 w-4" />
                AI Insights
                {insights && <Badge variant="secondary" className="ml-1 text-xs">{insights.keyFindings.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2" data-testid="tab-summary">
                <BookOpen className="h-4 w-4" />
                Easy Summary
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="h-[calc(85vh-140px)]">
            <TabsContent value="content" className="p-6 m-0">
              {document.type === "pdf" && document.fileUrl ? (
                <div className="w-full h-[60vh] rounded-lg overflow-hidden border">
                  <iframe
                    src={document.fileUrl}
                    className="w-full h-full"
                    title={document.title}
                    data-testid="iframe-pdf-viewer"
                  />
                </div>
              ) : document.content ? (
                <div className="prose dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {document.content}
                  </pre>
                </div>
              ) : document.fileUrl ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Document Preview</h3>
                  <p className="text-muted-foreground mb-4">
                    This document type requires an external viewer. Click below to open it.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => window.open(document.fileUrl, '_blank')} data-testid="button-open-external">
                      <Eye className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                    <Button variant="outline" onClick={() => onDownload(document)} data-testid="button-download-external">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Document Preview</h3>
                  <p className="text-muted-foreground mb-4">
                    Document content is not available for preview.
                  </p>
                  <Button variant="outline" onClick={() => onDownload(document)} data-testid="button-download-no-preview">
                    <Download className="h-4 w-4 mr-2" />
                    Download Document Data
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="insights" className="p-6 m-0">
              <DocumentInsightsPanel
                document={document}
                insights={displayedInsights}
                isLoading={analyzeMutation.isPending || isLoadingCached}
                onAnalyze={() => analyzeMutation.mutate()}
                error={analyzeError}
              />
            </TabsContent>
            <TabsContent value="summary" className="p-6 m-0">
              <DocumentSummarizer
                documentId={document.id}
                documentType={document.type}
                documentTitle={document.title}
                documentContent={document.content || document.description || ""}
                patientId={document.patientId}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </Card>
    </div>
  );
}

const documentTypeFilterOptions: FilterOption[] = [
  { id: "pdf", label: "PDF Document", icon: File },
  { id: "ccd", label: "CCD (Continuity of Care)", icon: FileCheck },
  { id: "lab_report", label: "Lab Report", icon: FileText },
  { id: "imaging_report", label: "Imaging Report", icon: FileImage },
  { id: "clinical_note", label: "Clinical Note", icon: FileText },
  { id: "discharge_summary", label: "Discharge Summary", icon: FileText },
];


export default function Documents() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithSource | null>(null);

  const { data: connections } = useQuery<EhrConnection[]>({
    queryKey: ['/api/ehr-connections'],
  });

  const { data: documents, isLoading, error } = useQuery<DocumentWithSource[]>({
    queryKey: ['/api/documents'],
  });

  useEffect(() => {
    trackDocumentEvent("documents_opened");
  }, []);

  const handleDownload = useCallback((doc: DocumentWithSource) => {
    trackDocumentEvent("document_downloaded", {
      documentId: doc.id,
      documentType: doc.type,
      source: doc.sourcePlatform,
    });
    
    const downloadUrl = `/api/documents/${doc.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const baseFilteredDocs = useAdvancedFilters(
    documents || [],
    filters,
    {
      getKeywords: (doc) => [doc.title, doc.description, doc.provider || "", doc.sourceFacility],
      getDate: (doc) => doc.dateOfService,
      getType: (doc) => doc.type,
      getTags: () => [],
    }
  );

  const filteredDocuments = sourceFilter === "all" 
    ? baseFilteredDocs 
    : baseFilteredDocs.filter(doc => doc.ehrConnectionId === sourceFilter);

  const hasActiveFilters = filters.keyword || filters.dateRange.from || filters.dateRange.to || 
    filters.selectedTypes.length > 0 || filters.selectedTags.length > 0 || sourceFilter !== "all";

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Documents</h1>
            <p className="text-muted-foreground">View, download, and share your health documents</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild data-testid="button-add-document">
              <Link href="/document-upload">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="button-export-documents">
              <Link href="/care-packets">
                <Share2 className="h-4 w-4 mr-2" />
                Export
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <AdvancedSearchFilter
            placeholder="Search documents by title, description, or provider..."
            typeOptions={documentTypeFilterOptions}
            tagOptions={[]}
            showDateFilter={true}
            showTypeFilter={true}
            showTagFilter={false}
            filters={filters}
            onFiltersChange={setFilters}
          />
          
          <div className="flex items-center gap-2">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-source-filter">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="select-item-docsource-all">All Sources</SelectItem>
                {connections?.map(conn => (
                  <SelectItem key={conn.id} value={conn.id} data-testid={`select-item-docsource-${conn.id}`}>
                    {conn.facilityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtered)'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        {isLoading ? (
          <div className="space-y-4" data-testid="documents-loading">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center" data-testid="documents-error">
            <FileText className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load Documents</h3>
            <p className="text-muted-foreground">
              There was a problem loading your documents. Please try again later.
            </p>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card className="p-8 text-center" data-testid="documents-empty">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your filters or search terms"
                : "Connect your health data sources to see your documents"}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onView={setSelectedDocument}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <DocumentViewerModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
