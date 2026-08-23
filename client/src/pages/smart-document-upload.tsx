import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Calendar,
  Tag,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Brain,
  FileImage,
  FilePlus,
  Trash2,
  ChevronRight,
  Info,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { clickable } from "@/lib/a11y";

interface DocumentCategory {
  primaryCategory: string;
  subcategory: string | null;
  suggestedFolderPath: string;
  suggestedTags: Array<{ namespace: string; value: string; displayName: string }>;
  documentType: string;
  dateOfService: string | null;
  providerName: string | null;
  facilityName: string | null;
  summary: string;
  isSensitive: boolean;
  confidence: number;
  extractedData: Record<string, any>;
}

interface CategoryOption {
  key: string;
  name: string;
  folderPath: string;
  subcategories: string[];
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "analyzing" | "analyzed" | "uploading" | "complete" | "error";
  category?: DocumentCategory;
  error?: string;
  title: string;
  selectedCategory?: string;
  selectedFolder?: string;
}

const categoryIcons: Record<string, typeof FileText> = {
  labs: FileText,
  imaging: FileImage,
  medications: FilePlus,
  diagnosis_pathology: FileText,
  treatment: FileText,
  surgery: FileText,
  follow_ups: Calendar,
  survivorship: FileText,
  side_effects: AlertCircle,
  insurance: FileText,
  general_medical: FileText,
};

export default function SmartDocumentUpload() {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedProfileId] = useState<string>("profile-default");
  const [isDragging, setIsDragging] = useState(false);

  const { data: categories } = useQuery<{ categories: CategoryOption[] }>({
    queryKey: ["/api/document-categorization/categories"],
  });

  const analyzeTextMutation = useMutation({
    mutationFn: async ({ content, filename, mimeType }: { content: string; filename: string; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/document-categorization/analyze-text", {
        content,
        filename,
        mimeType,
      });
      return response.json();
    },
  });

  const analyzeImageMutation = useMutation({
    mutationFn: async ({ base64Image, filename, mimeType }: { base64Image: string; filename: string; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/document-categorization/analyze-image", {
        base64Image,
        filename,
        mimeType,
      });
      return response.json();
    },
  });

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyzeFile = useCallback(async (uploadedFile: UploadedFile) => {
    setFiles(prev => prev.map(f => 
      f.id === uploadedFile.id ? { ...f, status: "analyzing" as const } : f
    ));

    try {
      let result: DocumentCategory;

      if (uploadedFile.file.type.startsWith("image/")) {
        const base64 = await readFileAsBase64(uploadedFile.file);
        result = await analyzeImageMutation.mutateAsync({
          base64Image: base64,
          filename: uploadedFile.file.name,
          mimeType: uploadedFile.file.type,
        });
      } else if (uploadedFile.file.type === "text/plain" || uploadedFile.file.name.endsWith(".txt")) {
        const content = await readFileAsText(uploadedFile.file);
        result = await analyzeTextMutation.mutateAsync({
          content,
          filename: uploadedFile.file.name,
          mimeType: uploadedFile.file.type,
        });
      } else {
        const base64 = await readFileAsBase64(uploadedFile.file);
        result = await analyzeImageMutation.mutateAsync({
          base64Image: base64,
          filename: uploadedFile.file.name,
          mimeType: uploadedFile.file.type,
        });
      }

      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id ? { 
          ...f, 
          status: "analyzed" as const, 
          category: result,
          title: result.summary.slice(0, 100) || uploadedFile.file.name,
          selectedCategory: result.primaryCategory,
          selectedFolder: result.suggestedFolderPath,
        } : f
      ));

      toast({
        title: "Document analyzed",
        description: `Categorized as ${result.documentType} with ${Math.round(result.confidence * 100)}% confidence`,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      setFiles(prev => prev.map(f => 
        f.id === uploadedFile.id ? { 
          ...f, 
          status: "error" as const, 
          error: "Failed to analyze document" 
        } : f
      ));
    }
  }, [analyzeImageMutation, analyzeTextMutation, toast]);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = droppedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: "pending" as const,
      title: file.name,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (const file of newFiles) {
      await analyzeFile(file);
    }
  }, [analyzeFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selectedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: "pending" as const,
      title: file.name,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    for (const file of newFiles) {
      await analyzeFile(file);
    }
  }, [analyzeFile]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileCategory = (id: string, category: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, selectedCategory: category } : f
    ));
  };

  const updateFileFolder = (id: string, folder: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, selectedFolder: folder } : f
    ));
  };

  const reanalyzeFile = async (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      await analyzeFile(file);
    }
  };

  const handleUploadAll = async () => {
    const analyzedFiles = files.filter(f => f.status === "analyzed");
    
    for (const file of analyzedFiles) {
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: "uploading" as const } : f
      ));

      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: "complete" as const } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: "error" as const, error: "Upload failed" } : f
        ));
      }
    }

    toast({
      title: "Documents uploaded",
      description: `${analyzedFiles.length} document(s) have been categorized and filed`,
    });
  };

  const analyzedCount = files.filter(f => f.status === "analyzed").length;
  const completedCount = files.filter(f => f.status === "complete").length;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Brain className="w-6 h-6 text-primary" />
          Smart Document Upload
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload medical documents and let AI automatically categorize them into the right sections
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Documents
              </CardTitle>
              <CardDescription>
                Drag and drop files or click to browse. Supports images, PDFs, and text files.
              </CardDescription>
            </CardHeader>
            <CardContent>
{/* The zone itself opens the file picker, so it is the only route to
                  it and `clickable` gives it a role, a tab stop and Enter/Space.
                  The linter cannot see a role supplied through a spread, hence
                  the exception for the drag handlers below. */}
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                {...clickable(() => document.getElementById("file-input")?.click())}
                data-testid="dropzone-upload"
              >
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-file"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Drop files here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will automatically analyze and categorize your documents
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5" />
                    Document Queue
                  </span>
                  <Badge variant="secondary">
                    {analyzedCount} ready / {files.length} total
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-4">
                    {files.map((file) => {
                      const CategoryIcon = file.category 
                        ? categoryIcons[file.category.primaryCategory] || FileText 
                        : FileText;

                      return (
                        <Card key={file.id} className="p-4">
                          <div className="flex items-start gap-4">
                            {file.preview ? (
                              <img 
                                src={file.preview} 
                                alt="" 
                                className="w-16 h-16 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                                <CategoryIcon className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium truncate" data-testid={`text-filename-${file.id}`}>
                                  {file.file.name}
                                </span>
                                {file.status === "analyzing" && (
                                  <Badge variant="secondary" className="shrink-0">
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Analyzing
                                  </Badge>
                                )}
                                {file.status === "analyzed" && file.category && (
                                  <Badge variant="default" className="shrink-0">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {Math.round(file.category.confidence * 100)}% confident
                                  </Badge>
                                )}
                                {file.status === "complete" && (
                                  <Badge className="shrink-0 bg-green-500">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Uploaded
                                  </Badge>
                                )}
                                {file.status === "error" && (
                                  <Badge variant="destructive" className="shrink-0">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Error
                                  </Badge>
                                )}
                              </div>

                              {file.status === "analyzed" && file.category && (
                                <div className="space-y-3 mt-3">
                                  <div className="text-sm text-muted-foreground">
                                    {file.category.summary}
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <FieldCaption className="text-xs">Category</FieldCaption>
                                      <Select 
                                        value={file.selectedCategory} 
                                        onValueChange={(v) => updateFileCategory(file.id, v)}
                                      >
                                        <SelectTrigger aria-label="Category" className="mt-1" data-testid={`select-category-${file.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categories?.categories.map(cat => (
                                            <SelectItem key={cat.key} value={cat.key}>
                                              {cat.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <FieldCaption className="text-xs">Folder</FieldCaption>
                                      <Select 
                                        value={file.selectedFolder}
                                        onValueChange={(v) => updateFileFolder(file.id, v)}
                                      >
                                        <SelectTrigger aria-label="Folder" className="mt-1" data-testid={`select-folder-${file.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categories?.categories.map(cat => (
                                            <SelectItem key={cat.folderPath} value={cat.folderPath}>
                                              {cat.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {file.category.suggestedTags.length > 0 && (
                                    <div>
                                      <FieldCaption className="text-xs">Suggested Tags</FieldCaption>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {file.category.suggestedTags.slice(0, 5).map((tag, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            <Tag className="w-3 h-3 mr-1" />
                                            {tag.displayName}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {file.category.dateOfService && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      Date of Service: {file.category.dateOfService}
                                    </div>
                                  )}

                                  {file.category.isSensitive && (
                                    <Alert variant="destructive" className="py-2">
                                      <AlertCircle className="w-4 h-4" />
                                      <AlertDescription className="text-xs">
                                        This document may contain sensitive information
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </div>
                              )}

                              {file.status === "error" && (
                                <p className="text-sm text-destructive mt-1">{file.error}</p>
                              )}
                            </div>

                            <div className="flex flex-col gap-1 shrink-0">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => reanalyzeFile(file.id)}
                                disabled={file.status === "analyzing"}
                                data-testid={`button-reanalyze-${file.id}`}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => removeFile(file.id)}
                                data-testid={`button-remove-${file.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setFiles([])}
                  data-testid="button-clear-all"
                >
                  Clear All
                </Button>
                <Button 
                  onClick={handleUploadAll}
                  disabled={analyzedCount === 0}
                  data-testid="button-upload-all"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Upload {analyzedCount} Document{analyzedCount !== 1 ? "s" : ""}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Categories
              </CardTitle>
              <CardDescription>
                AI will automatically sort documents into these folders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categories?.categories.map(cat => {
                  const Icon = categoryIcons[cat.key] || FileText;
                  return (
                    <div 
                      key={cat.key}
                      className="flex items-center gap-2 p-2 rounded-md hover-elevate"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{cat.name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Upload documents</p>
                    <p className="text-muted-foreground">
                      Drop files or click to select medical documents
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">AI analyzes content</p>
                    <p className="text-muted-foreground">
                      Documents are analyzed to identify type, category, and metadata
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Review and confirm</p>
                    <p className="text-muted-foreground">
                      Verify or adjust the suggested categories before uploading
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Documents filed</p>
                    <p className="text-muted-foreground">
                      Files are automatically organized in your health record
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Sparkles className="w-4 h-4" />
            <AlertTitle>AI-Powered</AlertTitle>
            <AlertDescription className="text-xs">
              Our AI categorizes documents but does not provide medical advice. 
              Always consult healthcare providers for medical decisions.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
