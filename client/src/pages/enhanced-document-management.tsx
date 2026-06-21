import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Search,
  Upload,
  History,
  Pill,
  TestTube,
  Stethoscope,
  FileImage,
  Calendar,
  User,
  Building2,
  Clock,
  GitBranch,
  Eye,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  BarChart3,
  ArrowLeftRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface ExtractedMedication {
  name: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  purpose: string | null;
}

interface ExtractedLabValue {
  testName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  isAbnormal: boolean;
  category: string;
}

interface ExtractedImagingFinding {
  modality: string;
  bodyPart: string;
  finding: string;
  impression: string | null;
  severity: string;
}

interface ExtractedDiagnosis {
  name: string;
  icdCode: string | null;
  status: string;
}

interface DocumentExtraction {
  medications: ExtractedMedication[];
  labValues: ExtractedLabValue[];
  imagingFindings: ExtractedImagingFinding[];
  diagnoses: ExtractedDiagnosis[];
  vitalSigns: any[];
  procedures: any[];
  keyDates: Array<{ date: string; description: string }>;
  providers: Array<{ name: string; role: string; facility: string | null }>;
  summary: string;
  extractionConfidence: number;
}

interface DocumentVersion {
  id: string;
  version: number;
  filename: string;
  uploadedAt: string;
  uploadedBy: string;
  changeNote: string | null;
  extraction: DocumentExtraction | null;
}

interface Document {
  id: string;
  profileId: string;
  title: string;
  category: string;
  currentVersion: number;
  versions: DocumentVersion[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  latestVersion?: DocumentVersion;
}

interface SearchResult {
  documentId: string;
  title: string;
  category: string;
  relevanceScore: number;
  matchedContent: string;
  highlightedSnippet: string;
  extraction: DocumentExtraction | null;
}

interface DocumentStats {
  totalDocuments: number;
  totalVersions: number;
  categoryCounts: Record<string, number>;
  extractedData: {
    medications: number;
    labValues: number;
    diagnoses: number;
  };
}

const categoryLabels: Record<string, string> = {
  labs: "Labs",
  imaging: "Imaging",
  medications: "Medications",
  diagnosis_pathology: "Diagnosis & Pathology",
  treatment: "Treatment",
  surgery: "Surgery",
  follow_ups: "Follow-ups",
  survivorship: "Survivorship",
  side_effects: "Side Effects",
  insurance: "Insurance",
  general_medical: "General Medical",
};

export default function EnhancedDocumentManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadContent, setUploadContent] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general_medical");
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null);
  const [showAddVersionDialog, setShowAddVersionDialog] = useState(false);
  const [newVersionContent, setNewVersionContent] = useState("");
  const [newVersionNote, setNewVersionNote] = useState("");

  const { data: documentsData, isLoading: documentsLoading } = useQuery<{ documents: Document[] }>({
    queryKey: ["/api/documents/enhanced"],
  });

  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ["/api/documents/enhanced/stats"],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/documents/enhanced/search", { query });
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { title: string; category: string; content: string }) => {
      const response = await apiRequest("POST", "/api/documents/enhanced", {
        ...data,
        profileId: "profile-1",
        filename: `${data.title.toLowerCase().replace(/\s+/g, "_")}.txt`,
        mimeType: "text/plain",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/enhanced/stats"] });
      setShowUploadDialog(false);
      setUploadContent("");
      setUploadTitle("");
      toast({ title: "Document uploaded", description: "AI extraction completed" });
    },
  });

  const addVersionMutation = useMutation({
    mutationFn: async ({ documentId, content, changeNote }: { documentId: string; content: string; changeNote: string }) => {
      const response = await apiRequest("POST", `/api/documents/enhanced/${documentId}/versions`, {
        content,
        filename: "updated_document.txt",
        mimeType: "text/plain",
        changeNote,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/enhanced"] });
      toast({ title: "New version added" });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const documents = documentsData?.documents || [];
  const searchResults = searchMutation.data?.results as SearchResult[] | undefined;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-6 h-6 text-primary" />
            Enhanced Document Management
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered document analysis with natural language search and version control
          </p>
        </div>
        <Link href="/document-analysis">
          <Button data-testid="button-ai-analysis">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Analysis
          </Button>
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Versions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVersions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Medications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <Pill className="w-4 h-4 text-blue-500" />
                {stats.extractedData.medications}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lab Values</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <TestTube className="w-4 h-4 text-green-500" />
                {stats.extractedData.labValues}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Diagnoses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <Stethoscope className="w-4 h-4 text-red-500" />
                {stats.extractedData.diagnoses}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search">
              <Search className="w-4 h-4 mr-2" />
              AI Search
            </TabsTrigger>
            <TabsTrigger value="extractions" data-testid="tab-extractions">
              <Sparkles className="w-4 h-4 mr-2" />
              Extractions
            </TabsTrigger>
          </TabsList>

          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-document">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload New Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter document title"
                    data-testid="input-document-title"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="content">Document Content</Label>
                  <Textarea
                    id="content"
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    placeholder="Paste or type document content here..."
                    className="min-h-[200px]"
                    data-testid="textarea-document-content"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate({ title: uploadTitle, category: uploadCategory, content: uploadContent })}
                  disabled={!uploadTitle || !uploadContent || uploadMutation.isPending}
                  data-testid="button-submit-upload"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Upload & Extract
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="documents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Documents</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {documentsLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : documents.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 px-4">
                        No documents yet. Upload your first document to get started.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {documents.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDocument(doc)}
                            className={`w-full text-left p-4 hover-elevate transition-colors ${
                              selectedDocument?.id === doc.id ? "bg-muted" : ""
                            }`}
                            data-testid={`button-document-${doc.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{doc.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {categoryLabels[doc.category] || doc.category}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    v{doc.currentVersion}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedDocument ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{selectedDocument.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{categoryLabels[selectedDocument.category]}</Badge>
                          <span className="text-xs">
                            Updated {formatDistanceToNow(new Date(selectedDocument.updatedAt), { addSuffix: true })}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {selectedDocument.versions.length} versions
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {selectedDocument.latestVersion?.extraction && (
                      <ExtractionDisplay extraction={selectedDocument.latestVersion.extraction} />
                    )}

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Version History
                        </h3>
                        <Dialog open={showAddVersionDialog} onOpenChange={setShowAddVersionDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" data-testid="button-add-version">
                              <Plus className="w-4 h-4 mr-1" />
                              Add Version
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Upload New Version</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="change-note">Change Note</Label>
                                <Input
                                  id="change-note"
                                  value={newVersionNote}
                                  onChange={(e) => setNewVersionNote(e.target.value)}
                                  placeholder="Describe the changes in this version"
                                  data-testid="input-change-note"
                                />
                              </div>
                              <div>
                                <Label htmlFor="version-content">Updated Content</Label>
                                <Textarea
                                  id="version-content"
                                  value={newVersionContent}
                                  onChange={(e) => setNewVersionContent(e.target.value)}
                                  placeholder="Paste the updated document content..."
                                  className="min-h-[200px]"
                                  data-testid="textarea-version-content"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowAddVersionDialog(false)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={() => {
                                  if (selectedDocument) {
                                    addVersionMutation.mutate({
                                      documentId: selectedDocument.id,
                                      content: newVersionContent,
                                      changeNote: newVersionNote || "Version update",
                                    });
                                    setShowAddVersionDialog(false);
                                    setNewVersionContent("");
                                    setNewVersionNote("");
                                  }
                                }}
                                disabled={!newVersionContent || addVersionMutation.isPending}
                                data-testid="button-submit-version"
                              >
                                {addVersionMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Upload & Extract
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-2">
                        {selectedDocument.versions.map((version, idx) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                v{version.version}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{version.changeNote || "Version " + version.version}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(version.uploadedAt), "PPp")}
                                  <span className="mx-1">by</span>
                                  {version.uploadedBy}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" data-testid={`button-view-version-${version.version}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {idx > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setCompareVersions({ 
                                    v1: selectedDocument.versions[idx - 1].version, 
                                    v2: version.version 
                                  })}
                                  data-testid={`button-compare-version-${version.version}`}
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center py-16">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Select a document to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Natural Language Search
              </CardTitle>
              <CardDescription>
                Ask questions in plain English to find relevant documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., 'Find lab results with abnormal values' or 'Show documents about chemotherapy'"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-search-query"
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={searchMutation.isPending || !searchQuery.trim()}
                  data-testid="button-search"
                >
                  {searchMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <p className="text-sm text-muted-foreground w-full">Try:</p>
                {[
                  "What medications am I taking?",
                  "Show imaging reports",
                  "Find abnormal lab values",
                  "Documents from oncology visits",
                ].map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      searchMutation.mutate(suggestion);
                    }}
                    data-testid={`button-suggestion-${suggestion.slice(0, 10)}`}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {searchResults && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No documents found matching your query
                  </p>
                ) : (
                  <div className="space-y-4">
                    {searchResults.map((result, idx) => (
                      <Card key={result.documentId} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{result.title}</p>
                              <Badge variant="outline">{categoryLabels[result.category]}</Badge>
                              <Badge variant="secondary">
                                {Math.round(result.relevanceScore * 100)}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{result.matchedContent}</p>
                            {result.highlightedSnippet && (
                              <p className="text-sm bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                                {result.highlightedSnippet}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const doc = documents.find(d => d.id === result.documentId);
                              if (doc) {
                                setSelectedDocument(doc);
                                setActiveTab("documents");
                              }
                            }}
                            data-testid={`button-view-result-${idx}`}
                          >
                            View
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="extractions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-500" />
                  All Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {documents.flatMap(doc => 
                      (doc.latestVersion?.extraction?.medications || []).map((med, idx) => (
                        <div key={`${doc.id}-med-${idx}`} className="p-3 rounded-lg border">
                          <p className="font-medium">{med.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            {med.dosage && <Badge variant="outline">{med.dosage}</Badge>}
                            {med.frequency && <span>{med.frequency}</span>}
                          </div>
                          {med.purpose && (
                            <p className="text-xs text-muted-foreground mt-1">{med.purpose}</p>
                          )}
                        </div>
                      ))
                    )}
                    {documents.flatMap(d => d.latestVersion?.extraction?.medications || []).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No medications extracted</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="w-5 h-5 text-green-500" />
                  All Lab Values
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {documents.flatMap(doc => 
                      (doc.latestVersion?.extraction?.labValues || []).map((lab, idx) => (
                        <div key={`${doc.id}-lab-${idx}`} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium">{lab.testName}</p>
                            <p className="text-sm text-muted-foreground">
                              {lab.value} {lab.unit}
                              {lab.referenceRange && ` (Ref: ${lab.referenceRange})`}
                            </p>
                          </div>
                          {lab.isAbnormal ? (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Abnormal
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Normal
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                    {documents.flatMap(d => d.latestVersion?.extraction?.labValues || []).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No lab values extracted</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-purple-500" />
                  Imaging Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {documents.flatMap(doc => 
                      (doc.latestVersion?.extraction?.imagingFindings || []).map((finding, idx) => (
                        <div key={`${doc.id}-img-${idx}`} className="p-3 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{finding.modality}</Badge>
                            <span className="font-medium">{finding.bodyPart}</span>
                          </div>
                          <p className="text-sm mt-1">{finding.finding}</p>
                          {finding.impression && (
                            <p className="text-sm text-muted-foreground mt-1 italic">{finding.impression}</p>
                          )}
                        </div>
                      ))
                    )}
                    {documents.flatMap(d => d.latestVersion?.extraction?.imagingFindings || []).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No imaging findings extracted</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-red-500" />
                  All Diagnoses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {documents.flatMap(doc => 
                      (doc.latestVersion?.extraction?.diagnoses || []).map((dx, idx) => (
                        <div key={`${doc.id}-dx-${idx}`} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium">{dx.name}</p>
                            {dx.icdCode && (
                              <p className="text-xs text-muted-foreground">{dx.icdCode}</p>
                            )}
                          </div>
                          <Badge variant={dx.status === "active" ? "default" : "secondary"}>
                            {dx.status}
                          </Badge>
                        </div>
                      ))
                    )}
                    {documents.flatMap(d => d.latestVersion?.extraction?.diagnoses || []).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No diagnoses extracted</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExtractionDisplay({ extraction }: { extraction: DocumentExtraction }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Extracted Information
        </h3>
        <Badge variant="outline">
          {Math.round(extraction.extractionConfidence * 100)}% confidence
        </Badge>
      </div>

      <p className="text-sm bg-muted p-3 rounded-lg">{extraction.summary}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Pill className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-lg font-bold">{extraction.medications.length}</p>
          <p className="text-xs text-muted-foreground">Medications</p>
        </div>
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
          <TestTube className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-lg font-bold">{extraction.labValues.length}</p>
          <p className="text-xs text-muted-foreground">Lab Values</p>
        </div>
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <FileImage className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <p className="text-lg font-bold">{extraction.imagingFindings.length}</p>
          <p className="text-xs text-muted-foreground">Imaging</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
          <Stethoscope className="w-5 h-5 mx-auto mb-1 text-red-500" />
          <p className="text-lg font-bold">{extraction.diagnoses.length}</p>
          <p className="text-xs text-muted-foreground">Diagnoses</p>
        </div>
      </div>

      {extraction.providers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {extraction.providers.map((provider, idx) => (
            <Badge key={idx} variant="outline" className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {provider.name}
              {provider.role && <span className="text-muted-foreground">({provider.role})</span>}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
