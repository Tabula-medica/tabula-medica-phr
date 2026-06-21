import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search,
  FileText,
  Calendar,
  Filter,
  Upload,
  Eye,
  Download,
  MessageSquare,
  Tag,
  Building2,
  User,
  Pill,
  Stethoscope,
  TestTube,
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Sparkles,
  ScanText,
  X,
  Plus,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { AIDocumentIntelligence } from "@/components/ai-document-intelligence";
import type { AutoTagCategory, DocumentAnnotation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface SearchParams {
  query: string;
  category: AutoTagCategory | "";
  dateFrom: string;
  dateTo: string;
  provider: string;
  facility: string;
  hasMedications: boolean;
  hasDiagnoses: boolean;
  hasLabResults: boolean;
  sortBy: "date" | "relevance" | "name";
  sortOrder: "asc" | "desc";
}

interface SearchResult {
  documentId: string;
  title: string;
  category: AutoTagCategory;
  date: string;
  facility?: string;
  provider?: string;
  matchScore: number;
  matchedTerms: string[];
  snippet: string;
}

interface OcrExtractionResult {
  documentId: string;
  extractedText: string;
  structuredData: {
    patientName?: string;
    dateOfBirth?: string;
    documentDate?: string;
    facility?: string;
    provider?: string;
    documentType?: string;
    diagnoses?: Array<{ code: string; description: string }>;
    medications?: Array<{ name: string; dosage: string; frequency: string }>;
    labResults?: Array<{ test: string; value: string; unit: string; referenceRange?: string; status?: string }>;
    vitalSigns?: Array<{ type: string; value: string; unit: string }>;
    procedures?: Array<{ code?: string; description: string; date?: string }>;
    allergies?: string[];
    summary?: string;
  };
  category: AutoTagCategory;
  confidence: number;
  processingTime: number;
  extractedAt: string;
}

const categoryLabels: Record<AutoTagCategory, string> = {
  discharge_summary: "Discharge Summary",
  lab: "Lab Results",
  imaging: "Imaging Report",
  insurance: "Insurance",
  referral: "Referral",
  other: "Other",
};

const categoryIcons: Record<AutoTagCategory, React.ElementType> = {
  discharge_summary: FileText,
  lab: TestTube,
  imaging: Eye,
  insurance: FileText,
  referral: FileText,
  other: FileText,
};

function SearchFilters({ 
  params, 
  onChange 
}: { 
  params: SearchParams; 
  onChange: (params: SearchParams) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="search-query">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-query"
              placeholder="Search documents, medications, diagnoses..."
              value={params.query}
              onChange={(e) => onChange({ ...params, query: e.target.value })}
              className="pl-10"
              data-testid="input-doc-search"
            />
          </div>
        </div>
        
        <Select 
          value={params.category || "all"} 
          onValueChange={(v) => onChange({ ...params, category: v === "all" ? "" : v as AutoTagCategory | "" })}
        >
          <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="discharge_summary">Discharge Summary</SelectItem>
            <SelectItem value="lab">Lab Results</SelectItem>
            <SelectItem value="imaging">Imaging</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="date-from" className="text-sm">From</Label>
          <Input
            id="date-from"
            type="date"
            value={params.dateFrom}
            onChange={(e) => onChange({ ...params, dateFrom: e.target.value })}
            className="w-[150px]"
            data-testid="input-filter-date-from"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date-to" className="text-sm">To</Label>
          <Input
            id="date-to"
            type="date"
            value={params.dateTo}
            onChange={(e) => onChange({ ...params, dateTo: e.target.value })}
            className="w-[150px]"
            data-testid="input-filter-date-to"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="has-meds"
            checked={params.hasMedications}
            onCheckedChange={(v) => onChange({ ...params, hasMedications: v })}
          />
          <Label htmlFor="has-meds" className="text-sm flex items-center gap-1">
            <Pill className="h-3 w-3" />
            Has medications
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="has-dx"
            checked={params.hasDiagnoses}
            onCheckedChange={(v) => onChange({ ...params, hasDiagnoses: v })}
          />
          <Label htmlFor="has-dx" className="text-sm flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />
            Has diagnoses
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="has-labs"
            checked={params.hasLabResults}
            onCheckedChange={(v) => onChange({ ...params, hasLabResults: v })}
          />
          <Label htmlFor="has-labs" className="text-sm flex items-center gap-1">
            <TestTube className="h-3 w-3" />
            Has lab results
          </Label>
        </div>
      </div>
    </div>
  );
}

function SearchResultCard({ result, onView }: { result: SearchResult; onView: () => void }) {
  const Icon = categoryIcons[result.category] || FileText;
  
  return (
    <Card className="hover-elevate" data-testid={`card-search-result-${result.documentId}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold truncate">{result.title}</h4>
              <Badge variant="secondary">{categoryLabels[result.category]}</Badge>
              <Badge variant="outline" className="text-xs">{result.matchScore}% match</Badge>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{result.snippet}</p>
            
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(result.date).toLocaleDateString()}</span>
              {result.facility && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <Building2 className="h-3 w-3" />
                  <span>{result.facility}</span>
                </>
              )}
              {result.provider && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <User className="h-3 w-3" />
                  <span>{result.provider}</span>
                </>
              )}
            </div>
            
            {result.matchedTerms.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Matched:</span>
                {result.matchedTerms.map((term, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{term}</Badge>
                ))}
              </div>
            )}
          </div>
          
          <Button variant="ghost" size="sm" onClick={onView} data-testid={`button-view-result-${result.documentId}`}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OcrPreviewPanel({ 
  extraction, 
  isLoading 
}: { 
  extraction: OcrExtractionResult | null; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Extracting Document Data...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!extraction) return null;
  
  const { structuredData } = extraction;
  
  return (
    <Card data-testid="card-ocr-preview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanText className="h-5 w-5" />
          AI-Extracted Data
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="secondary">{categoryLabels[extraction.category]}</Badge>
          <Badge variant="outline">{extraction.confidence}% confidence</Badge>
          <span className="text-xs">Processed in {extraction.processingTime}ms</span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {structuredData.summary && (
          <div>
            <h4 className="text-sm font-medium mb-1">Summary</h4>
            <p className="text-sm text-muted-foreground">{structuredData.summary}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          {structuredData.documentDate && (
            <div>
              <span className="text-muted-foreground">Document Date:</span>
              <span className="ml-2 font-medium">{structuredData.documentDate}</span>
            </div>
          )}
          {structuredData.facility && (
            <div>
              <span className="text-muted-foreground">Facility:</span>
              <span className="ml-2 font-medium">{structuredData.facility}</span>
            </div>
          )}
          {structuredData.provider && (
            <div>
              <span className="text-muted-foreground">Provider:</span>
              <span className="ml-2 font-medium">{structuredData.provider}</span>
            </div>
          )}
        </div>
        
        {structuredData.medications && structuredData.medications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Medications ({structuredData.medications.length})
            </h4>
            <div className="space-y-1">
              {structuredData.medications.map((med, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{med.name}</Badge>
                  <span className="text-muted-foreground">{med.dosage}</span>
                  <span className="text-muted-foreground">{med.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {structuredData.diagnoses && structuredData.diagnoses.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Diagnoses ({structuredData.diagnoses.length})
            </h4>
            <div className="space-y-1">
              {structuredData.diagnoses.map((dx, i) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  {dx.code && <Badge variant="secondary" className="text-xs">{dx.code}</Badge>}
                  <span>{dx.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {structuredData.labResults && structuredData.labResults.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Lab Results ({structuredData.labResults.length})
            </h4>
            <div className="space-y-1">
              {structuredData.labResults.map((lab, i) => (
                <div key={i} className="text-sm flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{lab.test}:</span>
                  <span className={lab.status === "critical" ? "text-red-600 font-bold" : 
                    lab.status === "high" || lab.status === "low" ? "text-amber-600" : ""}>
                    {lab.value} {lab.unit}
                  </span>
                  {lab.referenceRange && (
                    <span className="text-muted-foreground text-xs">({lab.referenceRange})</span>
                  )}
                  {lab.status && lab.status !== "normal" && (
                    <Badge variant={lab.status === "critical" ? "destructive" : "secondary"} className="text-xs">
                      {lab.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {structuredData.vitalSigns && structuredData.vitalSigns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Vital Signs
            </h4>
            <div className="flex flex-wrap gap-2">
              {structuredData.vitalSigns.map((vital, i) => (
                <Badge key={i} variant="outline">
                  {vital.type}: {vital.value} {vital.unit}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {structuredData.allergies && structuredData.allergies.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Allergies
            </h4>
            <div className="flex flex-wrap gap-2">
              {structuredData.allergies.map((allergy, i) => (
                <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          EDUCATIONAL CONTENT ONLY. Data extraction for informational purposes. NOT medical advice.
        </p>
      </CardFooter>
    </Card>
  );
}

function DocumentAnnotationPanel({
  documentId,
  annotations,
  onAddAnnotation,
  isLoading
}: {
  documentId: string;
  annotations: DocumentAnnotation[];
  onAddAnnotation: (body: string, pageNumber?: number, anchorText?: string) => void;
  isLoading: boolean;
}) {
  const [newComment, setNewComment] = useState("");
  const [pageNumber, setPageNumber] = useState<string>("");
  
  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddAnnotation(newComment, pageNumber ? parseInt(pageNumber) : undefined);
      setNewComment("");
      setPageNumber("");
    }
  };
  
  return (
    <Card data-testid="card-document-annotations">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Annotations ({annotations.length})
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note or comment about this document..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px]"
            data-testid="textarea-new-annotation"
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Page #"
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              className="w-20"
              type="number"
              data-testid="input-annotation-page"
            />
            <Button 
              onClick={handleSubmit} 
              disabled={!newComment.trim() || isLoading}
              data-testid="button-add-annotation"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Note
            </Button>
          </div>
        </div>
        
        <Separator />
        
        {annotations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No annotations yet. Add notes to keep track of important information.
          </p>
        ) : (
          <div className="space-y-3">
            {annotations.map((annotation) => (
              <div key={annotation.id} className="p-3 bg-muted/50 rounded-lg" data-testid={`annotation-${annotation.id}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <User className="h-3 w-3" />
                  <span>{annotation.authorName}</span>
                  <span>({annotation.authorRole})</span>
                  {annotation.pageNumber && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span>Page {annotation.pageNumber}</span>
                    </>
                  )}
                  <span className="text-muted-foreground/50">|</span>
                  <span>{new Date(annotation.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">{annotation.body}</p>
                {annotation.anchorText && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Re: "{annotation.anchorText}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DocumentManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("search");
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: "",
    category: "",
    dateFrom: "",
    dateTo: "",
    provider: "",
    facility: "",
    hasMedications: false,
    hasDiagnoses: false,
    hasLabResults: false,
    sortBy: "date",
    sortOrder: "desc",
  });
  
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const searchMutation = useMutation({
    mutationFn: async (params: SearchParams) => {
      const response = await apiRequest("POST", "/api/documents/search", {
        query: params.query || undefined,
        category: params.category || undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        provider: params.provider || undefined,
        facility: params.facility || undefined,
        hasMedications: params.hasMedications || undefined,
        hasDiagnoses: params.hasDiagnoses || undefined,
        hasLabResults: params.hasLabResults || undefined,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
  });
  
  const handleSearch = useCallback(() => {
    searchMutation.mutate(searchParams);
  }, [searchParams, searchMutation]);
  
  const { data: annotations = [], isLoading: isLoadingAnnotations } = useQuery<DocumentAnnotation[]>({
    queryKey: ["/api/documents", selectedDocumentId, "annotations"],
    queryFn: async () => {
      if (!selectedDocumentId) return [];
      const response = await fetch(`/api/documents/${selectedDocumentId}/annotations`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.annotations || [];
    },
    enabled: !!selectedDocumentId,
  });
  
  const addAnnotationMutation = useMutation({
    mutationFn: async (data: { body: string; pageNumber?: number; anchorText?: string }) => {
      if (!selectedDocumentId) throw new Error("No document selected");
      const response = await apiRequest("POST", `/api/documents/${selectedDocumentId}/annotations`, data);
      if (!response.ok) throw new Error("Failed to add annotation");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Annotation added" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDocumentId, "annotations"] });
    },
    onError: () => {
      toast({ title: "Failed to add annotation", variant: "destructive" });
    },
  });
  
  const handleViewDocument = async (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsExtracting(true);
    
    try {
      const response = await fetch(`/api/documents/ocr/${documentId}`);
      if (response.ok) {
        const data = await response.json();
        setOcrResult(data.data);
      } else {
        setOcrResult(null);
      }
    } catch (error) {
      setOcrResult(null);
    } finally {
      setIsExtracting(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Management</h1>
          <p className="text-muted-foreground">
            Search, organize, and annotate your medical documents with AI-powered extraction
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="h-4 w-4 mr-2" />
              Search & Filter
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload New
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <ScrollArea className="flex-1 p-4 md:p-6 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="search" className="mt-0">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Search & Filter Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SearchFilters params={searchParams} onChange={setSearchParams} />
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleSearch} disabled={searchMutation.isPending} data-testid="button-search">
                      {searchMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Search
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {searchMutation.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Results ({searchMutation.data.results?.length || 0})
                    </h3>
                    <Select 
                      value={searchParams.sortBy} 
                      onValueChange={(v) => setSearchParams({ ...searchParams, sortBy: v as any })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Sort by Date</SelectItem>
                        <SelectItem value="relevance">Sort by Relevance</SelectItem>
                        <SelectItem value="name">Sort by Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {searchMutation.data.results?.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No documents found matching your search criteria.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        {searchMutation.data.results?.map((result: SearchResult) => (
                          <SearchResultCard
                            key={result.documentId}
                            result={result}
                            onView={() => handleViewDocument(result.documentId)}
                          />
                        ))}
                      </div>
                      
                      <div className="space-y-4">
                        <OcrPreviewPanel extraction={ocrResult} isLoading={isExtracting} />
                        
                        {ocrResult?.extractedText && (
                          <AIDocumentIntelligence
                            documentText={ocrResult.extractedText}
                            documentType={ocrResult.category}
                            documentId={ocrResult.documentId}
                            onTagsApplied={(tags) => {
                              toast({
                                title: "Tags Applied",
                                description: `Added tags: ${tags.join(", ")}`,
                              });
                            }}
                            onFolderSelected={(folder, wasSuggested, suggestedFolder) => {
                              apiRequest("POST", "/api/analytics/document/auto-folder", {
                                userId: "current-user",
                                profileId: null,
                                documentId: ocrResult?.documentId,
                                suggestedFolder: suggestedFolder || folder,
                                wasAccepted: wasSuggested,
                                correctedFolder: wasSuggested ? null : folder,
                              }).catch(() => console.log("[Analytics] Failed to track folder selection"));
                              toast({
                                title: "Folder Selected",
                                description: `Document will be moved to: ${folder}`,
                              });
                            }}
                          />
                        )}
                        
                        {selectedDocumentId && (
                          <DocumentAnnotationPanel
                            documentId={selectedDocumentId}
                            annotations={annotations}
                            onAddAnnotation={(body, pageNumber, anchorText) => 
                              addAnnotationMutation.mutate({ body, pageNumber, anchorText })
                            }
                            isLoading={addAnnotationMutation.isPending}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!searchMutation.data && !searchMutation.isPending && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Search Your Documents</h3>
                    <p className="text-muted-foreground mb-4">
                      Use the filters above to search through your uploaded medical documents.
                      Find medications, diagnoses, lab results, and more.
                    </p>
                    <Button variant="outline" onClick={handleSearch}>
                      <Search className="h-4 w-4 mr-2" />
                      Search All Documents
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="upload" className="mt-0">
            <Card>
              <CardContent className="py-8 text-center">
                <Upload className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
                <p className="text-muted-foreground mb-4">
                  Go to the dedicated upload page for a full upload experience with AI classification.
                </p>
                <Button asChild>
                  <a href="/document-upload" data-testid="link-upload-page">
                    <Upload className="h-4 w-4 mr-2" />
                    Go to Upload Page
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
