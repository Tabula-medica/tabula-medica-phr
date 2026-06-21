import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Stethoscope,
  Building,
  Calendar,
  Tag,
  Brain,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Eye,
  Download,
  FolderOpen,
  FileImage,
  File,
  Loader2,
  Shield,
  Sparkles,
  User,
  Phone,
  Mail,
} from "lucide-react";

interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadDate: string;
  status: "processing" | "classified" | "review_needed" | "filed";
  documentType?: string;
  aiClassification?: {
    suggestedType: string;
    confidence: number;
    extractedTags: string[];
    extractedDate?: string;
    extractedProvider?: string;
    extractedFacility?: string;
  };
  manualTags?: string[];
}

interface DocumentType {
  value: string;
  label: string;
  description: string;
}

const documentTypes: DocumentType[] = [
  { value: "referral_letter", label: "Referral Letter", description: "Provider referral to specialist" },
  { value: "consultation_note", label: "Consultation Note", description: "Specialist consultation summary" },
  { value: "discharge_summary", label: "Discharge Summary", description: "Hospital discharge documentation" },
  { value: "lab_results", label: "Lab Results", description: "Laboratory test results" },
  { value: "imaging_report", label: "Imaging Report", description: "X-ray, MRI, CT scan reports" },
  { value: "pathology_report", label: "Pathology Report", description: "Biopsy and pathology findings" },
  { value: "procedure_note", label: "Procedure Note", description: "Surgical or procedure documentation" },
  { value: "medical_records", label: "Medical Records", description: "General medical documentation" },
  { value: "immunization_record", label: "Immunization Record", description: "Vaccination records" },
  { value: "insurance_form", label: "Insurance Form", description: "Insurance-related documentation" },
  { value: "other", label: "Other", description: "Uncategorized documents" },
];

const mockUploadedDocs: UploadedDocument[] = [
  {
    id: "doc-1",
    fileName: "Referral_Dr_Smith_01152026.pdf",
    fileType: "application/pdf",
    fileSize: "245 KB",
    uploadDate: "2026-01-15",
    status: "classified",
    documentType: "referral_letter",
    aiClassification: {
      suggestedType: "referral_letter",
      confidence: 0.94,
      extractedTags: ["Cardiology", "Chest pain evaluation"],
      extractedDate: "2026-01-14",
      extractedProvider: "Dr. Robert Smith, MD",
      extractedFacility: "Primary Care Associates",
    },
  },
  {
    id: "doc-2",
    fileName: "LabCorp_Results_01102026.pdf",
    fileType: "application/pdf",
    fileSize: "128 KB",
    uploadDate: "2026-01-10",
    status: "classified",
    documentType: "lab_results",
    aiClassification: {
      suggestedType: "lab_results",
      confidence: 0.98,
      extractedTags: ["Complete Blood Count", "Metabolic Panel", "Lipid Panel"],
      extractedDate: "2026-01-08",
      extractedProvider: "LabCorp",
      extractedFacility: "LabCorp Diagnostics",
    },
  },
  {
    id: "doc-3",
    fileName: "Hospital_Discharge_12202025.pdf",
    fileType: "application/pdf",
    fileSize: "512 KB",
    uploadDate: "2025-12-22",
    status: "review_needed",
    aiClassification: {
      suggestedType: "discharge_summary",
      confidence: 0.72,
      extractedTags: ["Appendectomy", "Post-operative care", "December 2025"],
      extractedDate: "2025-12-19",
      extractedFacility: "City General Hospital",
    },
  },
  {
    id: "doc-4",
    fileName: "Scan_IMG_4521.jpg",
    fileType: "image/jpeg",
    fileSize: "1.2 MB",
    uploadDate: "2026-01-16",
    status: "processing",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "classified": 
      return <Badge variant="default" className="bg-green-600 dark:bg-green-700"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
    case "processing": 
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
    case "review_needed": 
      return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400"><AlertCircle className="h-3 w-3 mr-1" />Review Needed</Badge>;
    case "filed": 
      return <Badge variant="outline"><FolderOpen className="h-3 w-3 mr-1" />Filed</Badge>;
    default: 
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getFileIcon(fileType: string) {
  if (fileType.includes("image")) return <FileImage className="h-5 w-5" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

export default function DocumentIntake() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [documents, setDocuments] = useState<UploadedDocument[]>(mockUploadedDocs);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manualType, setManualType] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          
          Array.from(files).forEach((file, idx) => {
            const newDoc: UploadedDocument = {
              id: `doc-new-${Date.now()}-${idx}`,
              fileName: file.name,
              fileType: file.type,
              fileSize: `${(file.size / 1024).toFixed(0)} KB`,
              uploadDate: new Date().toISOString().split("T")[0],
              status: "processing",
            };
            setDocuments(prev => [newDoc, ...prev]);
          });
          
          toast({ 
            title: `${files.length} document${files.length > 1 ? "s" : ""} uploaded`,
            description: "Classification in progress..."
          });
          
          setTimeout(() => {
            setDocuments(prev => prev.map(doc => {
              if (doc.status === "processing") {
                return {
                  ...doc,
                  status: "classified" as const,
                  aiClassification: {
                    suggestedType: "medical_records",
                    confidence: 0.85,
                    extractedTags: ["Medical Document", "Patient Record"],
                    extractedDate: new Date().toISOString().split("T")[0],
                  },
                };
              }
              return doc;
            }));
            toast({ title: "Classification complete" });
          }, 3000);
          
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleViewDocument = (doc: UploadedDocument) => {
    setSelectedDoc(doc);
    setManualType(doc.documentType || doc.aiClassification?.suggestedType || "");
    setManualTags(doc.manualTags?.join(", ") || doc.aiClassification?.extractedTags?.join(", ") || "");
    setShowDetailDialog(true);
  };

  const handleConfirmClassification = () => {
    if (!selectedDoc) return;
    
    setDocuments(prev => prev.map(doc => {
      if (doc.id === selectedDoc.id) {
        return {
          ...doc,
          status: "filed" as const,
          documentType: manualType,
          manualTags: manualTags.split(",").map(t => t.trim()).filter(Boolean),
        };
      }
      return doc;
    }));
    
    toast({ title: "Document filed" });
    setShowDetailDialog(false);
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
    toast({ title: "Document removed" });
  };

  const pendingReview = documents.filter(d => d.status === "review_needed" || d.status === "processing");
  const classifiedDocs = documents.filter(d => d.status === "classified" || d.status === "filed");

  return (
    <div className="p-6 space-y-6" data-testid="page-document-intake">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Document Intake
          </h1>
          <p className="text-muted-foreground">
            Upload referral letters, outside records, and other documents
          </p>
        </div>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">AI Classification Assistance</h4>
            <p className="text-sm text-muted-foreground">
              Classification shows document type and extracted metadata only. 
              This refers to organizational categorization. Medical questions refer to your healthcare provider.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{documents.length}</div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{pendingReview.length}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{classifiedDocs.length}</div>
              <div className="text-sm text-muted-foreground">Classified</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">AI</div>
              <div className="text-sm text-muted-foreground">Auto-Classification</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Review
            {pendingReview.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingReview.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            <FolderOpen className="h-4 w-4 mr-2" />
            All Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload referral letters, outside records, faxed documents, or any health-related paperwork
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragOver 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <div className="space-y-4">
                    <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                    <div>
                      <p className="font-medium">Uploading...</p>
                      <Progress value={uploadProgress} className="max-w-xs mx-auto mt-2" />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Drop files here or click to upload</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports PDF, images (JPG, PNG), and common document formats
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.tiff"
                      onChange={(e) => handleFileSelect(e.target.files)}
                      data-testid="input-file-upload"
                    />
                    <Button asChild>
                      <label htmlFor="file-upload" className="cursor-pointer" data-testid="button-select-files">
                        <Upload className="h-4 w-4 mr-2" />
                        Select Files
                      </label>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Classification Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium">1. Document Scan</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Document scan shows text content and document structure.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="font-medium">2. Auto-Classification</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Classification shows document type, dates, provider names, and relevant tags.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">3. Your Review</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Final classification shows your selection before the document is filed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents Pending Review</CardTitle>
              <CardDescription>
                Classification list shows documents for filing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReview.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">All Caught Up</h3>
                  <p className="text-muted-foreground">
                    No documents pending review at this time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReview.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => handleViewDocument(doc)}
                      data-testid={`card-pending-${doc.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          {getFileIcon(doc.fileType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{doc.fileName}</span>
                            {getStatusBadge(doc.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {doc.fileSize} | Uploaded: {doc.uploadDate}
                          </div>
                          {doc.aiClassification && (
                            <div className="flex items-center gap-2 mt-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              <span className="text-xs text-muted-foreground">
                                Classification shows: {documentTypes.find(t => t.value === doc.aiClassification?.suggestedType)?.label || doc.aiClassification.suggestedType}
                                {" "}({Math.round(doc.aiClassification.confidence * 100)}% match)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-review-${doc.id}`}>
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Documents</CardTitle>
              <CardDescription>
                Complete list of uploaded documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Documents</h3>
                  <p className="text-muted-foreground">
                    Upload your first document to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                      data-testid={`card-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          {getFileIcon(doc.fileType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{doc.fileName}</span>
                            {getStatusBadge(doc.status)}
                            {doc.documentType && (
                              <Badge variant="outline">
                                {documentTypes.find(t => t.value === doc.documentType)?.label || doc.documentType}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {doc.fileSize} | Uploaded: {doc.uploadDate}
                          </div>
                          {(doc.manualTags?.length || doc.aiClassification?.extractedTags?.length) && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              {(doc.manualTags || doc.aiClassification?.extractedTags || []).slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)} data-testid={`button-view-${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteDocument(doc.id)} data-testid={`button-delete-${doc.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Details
            </DialogTitle>
            <DialogDescription>
              Review classification details
            </DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  {getFileIcon(selectedDoc.fileType)}
                </div>
                <div>
                  <div className="font-medium">{selectedDoc.fileName}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedDoc.fileSize} | Uploaded: {selectedDoc.uploadDate}
                  </div>
                </div>
              </div>

              {selectedDoc.aiClassification && (
                <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-purple-800 dark:text-purple-200">Document Classification</h4>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                        Classification shows this document as a{" "}
                        <strong>{documentTypes.find(t => t.value === selectedDoc.aiClassification?.suggestedType)?.label}</strong>
                        {" "}({Math.round(selectedDoc.aiClassification.confidence * 100)}% match).
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {selectedDoc.aiClassification.extractedDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>Date: {selectedDoc.aiClassification.extractedDate}</span>
                          </div>
                        )}
                        {selectedDoc.aiClassification.extractedProvider && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>{selectedDoc.aiClassification.extractedProvider}</span>
                          </div>
                        )}
                        {selectedDoc.aiClassification.extractedFacility && (
                          <div className="flex items-center gap-2 col-span-2">
                            <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>{selectedDoc.aiClassification.extractedFacility}</span>
                          </div>
                        )}
                      </div>
                      {selectedDoc.aiClassification.extractedTags && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          {selectedDoc.aiClassification.extractedTags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={manualType} onValueChange={setManualType}>
                    <SelectTrigger data-testid="select-doc-type">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    placeholder="Enter tags separated by commas"
                    value={manualTags}
                    onChange={(e) => setManualTags(e.target.value)}
                    data-testid="input-tags"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tags show organization for document retrieval
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5" />
                  <p>
                    Classification shows the document type and extracted metadata. 
                    This refers to organizational categorization only.
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)} data-testid="button-cancel-review">
              Cancel
            </Button>
            <Button onClick={handleConfirmClassification} data-testid="button-confirm-classification">
              <CheckCircle className="h-4 w-4 mr-2" />
              File Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
