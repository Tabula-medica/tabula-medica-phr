import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  FileSearch,
  Tag,
  FileText,
  Calendar,
  User,
  Pill,
  Stethoscope,
  TestTube,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Folder,
  Clock,
  ChevronRight,
  Info,
  Loader2,
  Zap,
  Heart,
} from "lucide-react";

interface ExtractedInfo {
  dates: Array<{ type: string; value: string; context: string }>;
  names: Array<{ type: string; value: string; role?: string }>;
  dosages: Array<{ medication: string; dosage: string; frequency?: string; route?: string }>;
  diagnosisCodes: Array<{ code: string; system: string; description: string }>;
  procedures: Array<{ code?: string; description: string; date?: string }>;
  facilities: Array<{ name: string; type?: string; address?: string }>;
  labValues: Array<{ test: string; value: string; unit: string; referenceRange?: string; status?: string }>;
  allergies: string[];
  vitalSigns: Array<{ type: string; value: string; unit: string }>;
}

interface TagSuggestion {
  tags: Array<{ name: string; confidence: number; reason: string }>;
  suggestedFolder: { name: string; path: string; reason: string };
  category: string;
  urgency: "routine" | "urgent" | "critical";
  relatedDocuments: string[];
}

interface DocumentSummary {
  title: string;
  oneSentence: string;
  keyPoints: string[];
  clinicalRelevance: string;
  actionItems: string[];
  disclaimer: string;
}

interface CompleteAnalysis {
  extracted: Partial<ExtractedInfo>;
  organization: {
    tags: Array<{ name: string; confidence: number }>;
    suggestedFolder: string;
    category: string;
    urgency: string;
  };
  summary: {
    title: string;
    oneSentence: string;
    keyPoints: string[];
    actionItems: string[];
  };
}

interface AIDocumentIntelligenceProps {
  documentText: string;
  documentType?: string;
  documentId?: string;
  onTagsApplied?: (tags: string[]) => void;
  onFolderSelected?: (folder: string, wasSuggested: boolean, suggestedFolder?: string) => void;
}

export function AIDocumentIntelligence({
  documentText,
  documentType,
  documentId,
  onTagsApplied,
  onFolderSelected,
}: AIDocumentIntelligenceProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion | null>(null);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [completeAnalysis, setCompleteAnalysis] = useState<CompleteAnalysis | null>(null);

  const extractMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-documents/extract", {
        documentText,
        documentType,
        documentId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedInfo(data.extracted);
    },
    onError: () => {
      toast({
        title: "Extraction failed",
        description: "Unable to extract information. Please try again.",
        variant: "destructive",
      });
    },
  });

  const suggestTagsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-documents/suggest-tags", {
        documentText,
        documentType,
        documentId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTagSuggestions(data.suggestions);
    },
    onError: () => {
      toast({
        title: "Tag suggestion failed",
        description: "Unable to suggest tags. Please try again.",
        variant: "destructive",
      });
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-documents/summarize", {
        documentText,
        documentType,
        documentId,
        summaryLength: "standard",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSummary(data.summary);
    },
    onError: () => {
      toast({
        title: "Summarization failed",
        description: "Unable to summarize document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-documents/analyze-complete", {
        documentText,
        documentType,
        documentId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCompleteAnalysis(data.analysis);
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Unable to analyze document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApplyTags = (tags: string[]) => {
    onTagsApplied?.(tags);
  };

  const handleSelectFolder = (folder: string, isSuggestedFolder: boolean = true) => {
    const suggestedPath = tagSuggestions?.suggestedFolder?.path || completeAnalysis?.organization?.suggestedFolder?.path;
    onFolderSelected?.(folder, isSuggestedFolder, suggestedPath);
  };

  const isLoading = extractMutation.isPending || suggestTagsMutation.isPending || summarizeMutation.isPending || completeAnalysisMutation.isPending;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">AI Document Intelligence</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => completeAnalysisMutation.mutate()}
            disabled={isLoading || !documentText}
            className="min-h-[44px]"
            data-testid="button-analyze-document"
          >
            {completeAnalysisMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            Analyze Document
          </Button>
        </div>
        <CardDescription>
          AI-powered extraction, tagging, and summarization
        </CardDescription>
      </CardHeader>

      <Alert className="mx-4 mb-3">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Educational only. NOT medical advice. Consult your healthcare provider.
        </AlertDescription>
      </Alert>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 min-h-[44px]">
            <TabsTrigger value="overview" className="min-h-[44px]" data-testid="tab-overview">
              <Zap className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="extract" className="min-h-[44px]" data-testid="tab-extract">
              <FileSearch className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Extract</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="min-h-[44px]" data-testid="tab-tags">
              <Tag className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="min-h-[44px]" data-testid="tab-summary">
              <FileText className="h-4 w-4 mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {completeAnalysisMutation.isPending ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : completeAnalysis ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">{completeAnalysis.summary.title}</h3>
                  <p className="text-muted-foreground">{completeAnalysis.summary.oneSentence}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Folder className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-medium">Suggested Folder</span>
                    </div>
                    <p className="text-sm">{completeAnalysis.organization.suggestedFolder}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-medium">Category</span>
                    </div>
                    <Badge variant={completeAnalysis.organization.urgency === "critical" ? "destructive" : completeAnalysis.organization.urgency === "urgent" ? "default" : "secondary"}>
                      {completeAnalysis.organization.category}
                    </Badge>
                  </div>
                </div>

                {completeAnalysis.summary.keyPoints.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                      Key Points
                    </h4>
                    <ul className="space-y-1">
                      {completeAnalysis.summary.keyPoints.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {completeAnalysis.organization.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Suggested Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {completeAnalysis.organization.tags.slice(0, 6).map((tag, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] hover-elevate"
                          onClick={() => handleApplyTags([tag.name])}
                          data-testid={`button-quick-tag-${i}`}
                        >
                          <Tag className="h-3 w-3 mr-1" aria-hidden="true" />
                          {tag.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                <p>Click "Analyze Document" to get AI-powered insights</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="extract" className="mt-4">
            {!extractedInfo && !extractMutation.isPending && (
              <div className="text-center py-6">
                <Button
                  onClick={() => extractMutation.mutate()}
                  disabled={!documentText}
                  className="min-h-[44px]"
                  data-testid="button-extract-info"
                >
                  <FileSearch className="h-4 w-4 mr-2" aria-hidden="true" />
                  Extract Key Information
                </Button>
              </div>
            )}

            {extractMutation.isPending && (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {extractedInfo && (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {extractedInfo.dates.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        Dates ({extractedInfo.dates.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.dates.map((date, i) => (
                          <div key={i} className="text-sm flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <Badge variant="outline" className="text-xs">{date.type}</Badge>
                            <span className="font-medium">{date.value}</span>
                            <span className="text-muted-foreground">- {date.context}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.names.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" aria-hidden="true" />
                        Names ({extractedInfo.names.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.names.map((name, i) => (
                          <div key={i} className="text-sm flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <Badge variant="outline" className="text-xs">{name.type}</Badge>
                            <span className="font-medium">{name.value}</span>
                            {name.role && <span className="text-muted-foreground">({name.role})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.dosages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Pill className="h-4 w-4" aria-hidden="true" />
                        Medications ({extractedInfo.dosages.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.dosages.map((med, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                            <span className="font-medium">{med.medication}</span>
                            <span className="text-primary ml-2">{med.dosage}</span>
                            {med.frequency && <span className="text-muted-foreground ml-2">{med.frequency}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.diagnosisCodes.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" aria-hidden="true" />
                        Diagnosis Codes ({extractedInfo.diagnosisCodes.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.diagnosisCodes.map((dx, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                            <Badge variant="secondary" className="mr-2">{dx.code}</Badge>
                            <span>{dx.description}</span>
                            <span className="text-xs text-muted-foreground ml-2">({dx.system})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.labValues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TestTube className="h-4 w-4" aria-hidden="true" />
                        Lab Values ({extractedInfo.labValues.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.labValues.map((lab, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between">
                            <span className="font-medium">{lab.test}</span>
                            <div className="flex items-center gap-2">
                              <span>{lab.value} {lab.unit}</span>
                              {lab.status && (
                                <Badge variant={lab.status === "critical" ? "destructive" : lab.status === "abnormal" ? "default" : "secondary"}>
                                  {lab.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.allergies.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        Allergies ({extractedInfo.allergies.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {extractedInfo.allergies.map((allergy, i) => (
                          <Badge key={i} variant="destructive">{allergy}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.facilities.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                        Facilities ({extractedInfo.facilities.length})
                      </h4>
                      <div className="space-y-1">
                        {extractedInfo.facilities.map((facility, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                            <span className="font-medium">{facility.name}</span>
                            {facility.type && <Badge variant="outline" className="ml-2 text-xs">{facility.type}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedInfo.vitalSigns.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Heart className="h-4 w-4" aria-hidden="true" />
                        Vital Signs ({extractedInfo.vitalSigns.length})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {extractedInfo.vitalSigns.map((vital, i) => (
                          <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                            <span className="text-muted-foreground">{vital.type}:</span>
                            <span className="font-medium ml-1">{vital.value} {vital.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="tags" className="mt-4">
            {!tagSuggestions && !suggestTagsMutation.isPending && (
              <div className="text-center py-6">
                <Button
                  onClick={() => suggestTagsMutation.mutate()}
                  disabled={!documentText}
                  className="min-h-[44px]"
                  data-testid="button-suggest-tags"
                >
                  <Tag className="h-4 w-4 mr-2" aria-hidden="true" />
                  Suggest Tags & Folders
                </Button>
              </div>
            )}

            {suggestTagsMutation.isPending && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {tagSuggestions && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Folder className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h4 className="font-medium">Suggested Folder</h4>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium">{tagSuggestions.suggestedFolder.name}</p>
                      <p className="text-sm text-muted-foreground">{tagSuggestions.suggestedFolder.path}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tagSuggestions.suggestedFolder.reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectFolder(tagSuggestions.suggestedFolder.path, true)}
                        className="min-h-[44px]"
                        data-testid="button-apply-folder"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSelectFolder("/documents/other", false)}
                        className="min-h-[44px]"
                        data-testid="button-choose-different-folder"
                      >
                        Choose Different
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline">{tagSuggestions.category}</Badge>
                  <Badge variant={tagSuggestions.urgency === "critical" ? "destructive" : tagSuggestions.urgency === "urgent" ? "default" : "secondary"}>
                    {tagSuggestions.urgency}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Suggested Tags</h4>
                  <div className="space-y-2">
                    {tagSuggestions.tags.map((tag, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge>{tag.name}</Badge>
                          <span className="text-xs text-muted-foreground">{Math.round(tag.confidence * 100)}% confidence</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApplyTags([tag.name])}
                          className="min-h-[44px]"
                          data-testid={`button-apply-tag-${i}`}
                        >
                          Add Tag
                        </Button>
                      </div>
                    ))}
                  </div>
                  {tagSuggestions.tags.length > 0 && (
                    <Button
                      className="w-full mt-3 min-h-[44px]"
                      variant="outline"
                      onClick={() => handleApplyTags(tagSuggestions.tags.map(t => t.name))}
                      data-testid="button-apply-all-tags"
                    >
                      Apply All Tags
                    </Button>
                  )}
                </div>

                {tagSuggestions.relatedDocuments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Related Document Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {tagSuggestions.relatedDocuments.map((doc, i) => (
                        <Badge key={i} variant="secondary">{doc}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            {!summary && !summarizeMutation.isPending && (
              <div className="text-center py-6">
                <Button
                  onClick={() => summarizeMutation.mutate()}
                  disabled={!documentText}
                  className="min-h-[44px]"
                  data-testid="button-summarize"
                >
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  Summarize Document
                </Button>
              </div>
            )}

            {summarizeMutation.isPending && (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {summary && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="font-semibold text-lg">{summary.title}</h3>
                  <p className="text-muted-foreground mt-1">{summary.oneSentence}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                    Key Points
                  </h4>
                  <ul className="space-y-2">
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} className="text-sm flex items-start gap-2 p-2 bg-muted/50 rounded">
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Clinical Relevance</h4>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">{summary.clinicalRelevance}</p>
                </div>

                {summary.actionItems.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      Action Items
                    </h4>
                    <ul className="space-y-1">
                      {summary.actionItems.map((item, i) => (
                        <li key={i} className="text-sm flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator />

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {summary.disclaimer}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
