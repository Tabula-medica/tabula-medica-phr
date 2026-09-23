import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Upload,
  FileText,
  Calendar,
  Tag,
  X,
  CheckCircle,
  AlertCircle,
  File,
  FileImage,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Edit2,
  Info,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UploadedDocument, AutoTagCategory, AutoTagSubcategory, DocumentAutoTag } from "@shared/schema";
import { autoTagSubcategories, autoTagSubcategoryLabels, uploadedDocumentTypeToAutoTagCategory } from "@shared/schema";

const documentTypes = [
  { value: "insurance_card", label: "Insurance Card" },
  { value: "id_document", label: "ID Document" },
  { value: "medical_record", label: "Medical Record" },
  { value: "lab_result", label: "Lab Result" },
  { value: "imaging", label: "Imaging Report" },
  { value: "prescription", label: "Prescription" },
  { value: "referral", label: "Referral" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "advance_directive", label: "Advance Directive" },
  { value: "immunization_record", label: "Immunization Record" },
  { value: "other", label: "Other" },
];

// Auto-tag categories (matches schema)
const autoTagCategories: { value: AutoTagCategory; label: string }[] = [
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "lab", label: "Lab Results" },
  { value: "imaging", label: "Imaging Report" },
  { value: "insurance", label: "Insurance Document" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

// Map auto-tag category to document type
const autoTagToDocumentType: Record<AutoTagCategory, string> = {
  discharge_summary: "discharge_summary",
  lab: "lab_result",
  imaging: "imaging",
  insurance: "insurance_card",
  referral: "referral",
  other: "other",
};

const uploadFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  documentDate: z.string().optional(),
  documentType: z.string().min(1, "Document type is required"),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// Subcategory choices offered for a given document type (via its auto-tag category)
const getSubcategoryOptions = (documentType: string): AutoTagSubcategory[] => {
  const category = uploadedDocumentTypeToAutoTagCategory[documentType as keyof typeof uploadedDocumentTypeToAutoTagCategory];
  return category ? [...autoTagSubcategories[category]] : [];
};

type UploadFormValues = z.infer<typeof uploadFormSchema>;

const trackUploadEvent = async (
  eventType: "document_upload_started" | "document_upload_success" | "document_upload_failed",
  metadata?: Record<string, string>
) => {
  try {
    await apiRequest("POST", "/api/document-uploads/analytics", { eventType, metadata });
  } catch (error) {
    console.error("[Document Upload Analytics] Failed to track event:", error);
  }
};

const trackAutoTagEvent = async (
  eventType: "doc_autotag_applied" | "doc_autotag_overridden",
  metadata?: Record<string, string>
) => {
  try {
    await apiRequest("POST", "/api/documents/autotag-analytics", { eventType, metadata });
  } catch (error) {
    console.error("[Auto-Tag Analytics] Failed to track event:", error);
  }
};

// Auto-tag result with extended info
interface AutoTagResult {
  id: string;
  documentId: string;
  category: AutoTagCategory;
  categoryLabel: string;
  subcategory?: AutoTagSubcategory | null;
  subcategoryLabel?: string | null;
  confidence: number;
  explanation: string;
  suggestedTags: string[];
  isOverridden: boolean;
  overriddenCategory?: AutoTagCategory;
  overriddenSubcategory?: AutoTagSubcategory | null;
}

function UploadedDocumentCard({ 
  document, 
  autoTag,
  onDelete,
  onOverride,
}: { 
  document: UploadedDocument; 
  autoTag?: AutoTagResult | null;
  onDelete?: (id: string) => void;
  onOverride?: (documentId: string) => void;
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const typeLabel = documentTypes.find(t => t.value === document.documentType)?.label || document.documentType;
  const effectiveCategory = autoTag?.isOverridden ? autoTag.overriddenCategory : autoTag?.category;
  const effectiveCategoryLabel = autoTagCategories.find(c => c.value === effectiveCategory)?.label || effectiveCategory;
  const effectiveSubcategory = autoTag?.isOverridden ? autoTag.overriddenSubcategory : autoTag?.subcategory;
  const effectiveSubcategoryLabel = effectiveSubcategory ? autoTagSubcategoryLabels[effectiveSubcategory] : null;

  return (
    <Card className="hover-elevate" data-testid={`card-uploaded-doc-${document.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            {document.mimeType?.startsWith("image/") ? (
              <FileImage className="h-6 w-6 text-primary" />
            ) : (
              <File className="h-6 w-6 text-primary" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-semibold truncate" data-testid={`text-doc-title-${document.id}`}>
                {document.title}
              </h4>
              <Badge variant="secondary">{typeLabel}</Badge>
              {document.subcategory && (
                <Badge variant="outline" data-testid={`badge-doc-subcategory-${document.id}`}>
                  {autoTagSubcategoryLabels[document.subcategory as AutoTagSubcategory] || document.subcategory}
                </Badge>
              )}
              {document.scanStatus === "clean" && (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {document.originalFileName}
            </p>
            
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Uploaded {formatDate(document.uploadedAt)}</span>
              {document.documentDate && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>Document date: {formatDate(document.documentDate)}</span>
                </>
              )}
              <span className="text-muted-foreground/50">|</span>
              <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
            </div>
            
            {/* Auto-tag section with AI explanation */}
            {autoTag && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border" data-testid={`autotag-section-${document.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">AI Classification</span>
                    <Badge variant={autoTag.isOverridden ? "outline" : "default"} className="text-xs">
                      {effectiveCategoryLabel}
                      {effectiveSubcategoryLabel && ` · ${effectiveSubcategoryLabel}`}
                      {autoTag.isOverridden && " (Overridden)"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {autoTag.confidence}% confidence
                    </Badge>
                  </div>
                  {onOverride && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOverride(document.id)}
                      data-testid={`button-override-tag-${document.id}`}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Override
                    </Button>
                  )}
                </div>
                
                {/* Explanation (why tagged) */}
                <div className="mt-2 flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground" data-testid={`autotag-explanation-${document.id}`}>
                    {autoTag.explanation}
                  </p>
                </div>
                
                {/* Suggested tags */}
                {autoTag.suggestedTags && autoTag.suggestedTags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {autoTag.suggestedTags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {document.tags && document.tags.length > 0 && !autoTag && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {document.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(document.id)}
              data-testid={`button-delete-doc-${document.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DocumentUpload() {
  const [tagInput, setTagInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; type: string; objectPath: string } | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Auto-tag state
  const [documentAutoTags, setDocumentAutoTags] = useState<Map<string, AutoTagResult>>(new Map());
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedDocumentForOverride, setSelectedDocumentForOverride] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<AutoTagCategory>("other");
  const [overrideSubcategory, setOverrideSubcategory] = useState<string>("none");
  const [overrideReason, setOverrideReason] = useState("");

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      documentDate: "",
      documentType: "other",
      subcategory: "",
      tags: [],
    },
  });

  const { data: uploadedDocuments, isLoading: isLoadingDocuments } = useQuery<UploadedDocument[]>({
    queryKey: ["/api/document-uploads"],
  });
  
  // Fetch existing auto-tags for uploaded documents
  useEffect(() => {
    if (uploadedDocuments && uploadedDocuments.length > 0) {
      uploadedDocuments.forEach(async (doc) => {
        // Skip if we already have this auto-tag
        if (documentAutoTags.has(doc.id)) return;
        
        try {
          const response = await fetch(`/api/documents/${doc.id}/auto-tag`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (data.autoTag) {
              setDocumentAutoTags(prev => new Map(prev).set(doc.id, data.autoTag));
            }
          }
          // 404 is expected for documents that haven't been auto-tagged yet
        } catch (error) {
          // Ignore errors - auto-tag may not exist for this document
        }
      });
    }
  }, [uploadedDocuments]);
  
  // Auto-tag a document mutation
  const autoTagMutation = useMutation({
    mutationFn: async (data: { documentId: string; fileName: string; mimeType: string }) => {
      const response = await apiRequest("POST", `/api/documents/${data.documentId}/auto-tag`, {
        fileName: data.fileName,
        mimeType: data.mimeType,
        textContent: data.fileName, // Using filename for classification when content not available
      });
      if (!response.ok) {
        throw new Error("Failed to auto-tag document");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.autoTag) {
        setDocumentAutoTags(prev => new Map(prev).set(variables.documentId, data.autoTag));
      }
    },
    onError: (error) => {
      console.error("[Auto-Tag] Failed:", error);
    },
  });
  
  // Override auto-tag mutation
  const overrideTagMutation = useMutation({
    mutationFn: async (data: { documentId: string; newCategory: AutoTagCategory; newSubcategory?: string | null; reason?: string }) => {
      const response = await apiRequest("POST", `/api/documents/${data.documentId}/override-tag`, {
        newCategory: data.newCategory,
        newSubcategory: data.newSubcategory,
        reason: data.reason,
      });
      if (!response.ok) {
        throw new Error("Failed to override tag");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.autoTag) {
        setDocumentAutoTags(prev => new Map(prev).set(variables.documentId, data.autoTag));
        trackAutoTagEvent("doc_autotag_overridden", {
          newCategory: variables.newCategory,
        });
      }
      setOverrideDialogOpen(false);
      setSelectedDocumentForOverride(null);
      setOverrideReason("");
    },
    onError: (error) => {
      console.error("[Override Tag] Failed:", error);
    },
  });
  
  // Handle opening override dialog
  const handleOverrideClick = (documentId: string) => {
    const currentAutoTag = documentAutoTags.get(documentId);
    setSelectedDocumentForOverride(documentId);
    setOverrideCategory(currentAutoTag?.category || "other");
    setOverrideSubcategory(currentAutoTag?.subcategory || "none");
    setOverrideDialogOpen(true);
  };

  // Handle submitting override
  const handleOverrideSubmit = () => {
    if (selectedDocumentForOverride) {
      overrideTagMutation.mutate({
        documentId: selectedDocumentForOverride,
        newCategory: overrideCategory,
        newSubcategory: overrideSubcategory === "none" ? null : overrideSubcategory,
        reason: overrideReason || undefined,
      });
    }
  };

  const completeMutation = useMutation({
    mutationFn: async (data: {
      objectPath: string;
      title: string;
      documentDate?: string;
      documentType: string;
      subcategory?: string;
      tags: string[];
      originalFileName: string;
      mimeType: string;
      fileSize: number;
    }) => {
      const response = await apiRequest("POST", "/api/document-uploads/complete", data);
      if (!response.ok) {
        throw new Error("Failed to complete upload");
      }
      return response.json();
    },
    onSuccess: (data) => {
      trackUploadEvent("document_upload_success", {
        documentType: form.getValues("documentType"),
      });
      setUploadResult({ success: true, message: "Document uploaded successfully. Classifying with AI..." });
      
      // Trigger auto-tagging after successful upload
      if (data.document?.id && pendingFile) {
        autoTagMutation.mutate({
          documentId: data.document.id,
          fileName: pendingFile.name,
          mimeType: pendingFile.type,
        });
      }
      
      form.reset();
      setPendingFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/document-uploads"] });
    },
    onError: (error) => {
      trackUploadEvent("document_upload_failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      setUploadResult({ success: false, message: "Failed to save document" });
    },
  });

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.getValues("tags").includes(tag)) {
      form.setValue("tags", [...form.getValues("tags"), tag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    form.setValue("tags", form.getValues("tags").filter(t => t !== tagToRemove));
  };

  const handleGetUploadParameters = useCallback(async (file: any) => {
    const formValues = form.getValues();
    
    trackUploadEvent("document_upload_started", {
      documentType: formValues.documentType,
      fileSize: file.size.toString(),
      mimeType: file.type,
    });

    const response = await apiRequest("POST", "/api/document-uploads/request-url", {
      name: file.name,
      size: file.size,
      contentType: file.type,
      title: formValues.title,
      documentDate: formValues.documentDate,
      documentType: formValues.documentType,
      subcategory: formValues.subcategory || undefined,
      tags: formValues.tags,
    });

    if (!response.ok) {
      const error = await response.json();
      trackUploadEvent("document_upload_failed", {
        reason: error.error || "validation_failed",
      });
      throw new Error(error.error || "Failed to get upload URL");
    }

    const data = await response.json();
    
    // Store objectPath for use in complete mutation
    setPendingFile({
      name: file.name,
      size: file.size,
      type: file.type,
      objectPath: data.objectPath,
    });

    return {
      method: "PUT" as const,
      url: data.uploadURL,
      headers: { "Content-Type": file.type },
    };
  }, [form]);

  const handleUploadComplete = useCallback(async (result: any) => {
    const successfulFiles = result.successful || [];
    if (successfulFiles.length > 0 && pendingFile) {
      const formValues = form.getValues();
      
      // Use the objectPath we stored from the request-url response
      completeMutation.mutate({
        objectPath: pendingFile.objectPath,
        title: formValues.title,
        documentDate: formValues.documentDate,
        documentType: formValues.documentType,
        subcategory: formValues.subcategory || undefined,
        tags: formValues.tags,
        originalFileName: pendingFile.name,
        mimeType: pendingFile.type,
        fileSize: pendingFile.size,
      });
    }

    const failedFiles = result.failed || [];
    if (failedFiles.length > 0) {
      trackUploadEvent("document_upload_failed", {
        reason: "upload_failed",
      });
      setUploadResult({ success: false, message: "File upload failed" });
    }
  }, [pendingFile, form, completeMutation]);

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload Document</h1>
          <p className="text-muted-foreground">
            Upload PDFs and images of your medical records, insurance cards, and other health documents
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 md:p-6 pt-0">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload New Document
              </CardTitle>
              <CardDescription>
                Supported formats: PDF, JPEG, PNG, GIF, WebP, HEIC. Max size: 25MB.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Title *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Annual Physical Results 2026"
                            {...field}
                            data-testid="input-doc-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="documentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("subcategory", "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-doc-type">
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                data-testid={`select-item-type-${type.value}`}
                              >
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {getSubcategoryOptions(form.watch("documentType")).length > 0 && (
                    <FormField
                      control={form.control}
                      name="subcategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subcategory</FormLabel>
                          <Select
                            value={field.value || "none"}
                            onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-doc-subcategory">
                                <SelectValue placeholder="Select subcategory (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none" data-testid="select-item-subcategory-none">
                                Not specified
                              </SelectItem>
                              {getSubcategoryOptions(form.watch("documentType")).map((sub) => (
                                <SelectItem
                                  key={sub}
                                  value={sub}
                                  data-testid={`select-item-subcategory-${sub}`}
                                >
                                  {autoTagSubcategoryLabels[sub]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Narrow down what kind of {documentTypes.find(t => t.value === form.watch("documentType"))?.label.toLowerCase() || "record"} this is
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="documentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-doc-date"
                          />
                        </FormControl>
                        <FormDescription>
                          When was this document created or when did this visit occur?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a tag..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag();
                              }
                            }}
                            data-testid="input-tag"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={addTag}
                            data-testid="button-add-tag"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {field.value.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {field.value.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="gap-1">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(tag)}
                                  className="ml-1 rounded-full hover:bg-muted"
                                  data-testid={`button-remove-tag-${i}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <FormDescription>
                          Add tags to help organize and find this document later
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={25 * 1024 * 1024}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select File to Upload
                    </ObjectUploader>
                  </div>

                  {uploadResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-lg ${
                        uploadResult.success
                          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      }`}
                      data-testid="upload-result"
                    >
                      {uploadResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{uploadResult.message}</span>
                    </div>
                  )}

                  {completeMutation.isPending && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving document...</span>
                    </div>
                  )}
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Uploaded Documents
              </CardTitle>
              <CardDescription>
                Documents you have uploaded to your health record
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDocuments ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : uploadedDocuments && uploadedDocuments.length > 0 ? (
                <div className="space-y-4">
                  {uploadedDocuments.map((doc) => (
                    <UploadedDocumentCard 
                      key={doc.id} 
                      document={doc}
                      autoTag={documentAutoTags.get(doc.id)}
                      onOverride={handleOverrideClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
                  <p className="text-muted-foreground">
                    Upload your first document using the form on the left
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      
      {/* Override Tag Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent data-testid="dialog-override-tag">
          <DialogHeader>
            <DialogTitle>Override Document Classification</DialogTitle>
            <DialogDescription>
              Change the AI-assigned category for this document. This helps improve your document library organization.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="override-category">New Category</Label>
              <Select
                value={overrideCategory}
                onValueChange={(value) => {
                  setOverrideCategory(value as AutoTagCategory);
                  setOverrideSubcategory("none");
                }}
              >
                <SelectTrigger id="override-category" data-testid="select-override-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {autoTagCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} data-testid={`select-item-category-${cat.value}`}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {autoTagSubcategories[overrideCategory].length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="override-subcategory">New Subcategory</Label>
                <Select value={overrideSubcategory} onValueChange={setOverrideSubcategory}>
                  <SelectTrigger id="override-subcategory" data-testid="select-override-subcategory">
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-testid="select-item-override-subcategory-none">
                      Not specified
                    </SelectItem>
                    {autoTagSubcategories[overrideCategory].map((sub) => (
                      <SelectItem key={sub} value={sub} data-testid={`select-item-override-subcategory-${sub}`}>
                        {autoTagSubcategoryLabels[sub]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason (Optional)</Label>
              <Input
                id="override-reason"
                placeholder="Why are you changing this classification?"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                data-testid="input-override-reason"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOverrideDialogOpen(false)}
              data-testid="button-cancel-override"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleOverrideSubmit}
              disabled={overrideTagMutation.isPending}
              data-testid="button-confirm-override"
            >
              {overrideTagMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
