import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Upload,
  FileText,
  Tag,
  Calendar,
  Building2,
  User,
  FlaskConical,
  Activity,
  FileCheck,
  Clock,
  Sparkles,
  Check,
  AlertCircle,
  Heart,
  Stethoscope,
  ClipboardList,
  FileImage,
  Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DocumentType = 
  | "discharge_summary"
  | "lab_report"
  | "imaging_report"
  | "operative_note"
  | "insurance_letter"
  | "prescription"
  | "referral"
  | "progress_note"
  | "unknown";

interface DocumentMetadata {
  date: string | null;
  facility: string | null;
  bodyPart: string | null;
  testName: string | null;
  provider: string | null;
  patientName: string | null;
}

interface TaggedDocument {
  id: string;
  filename: string;
  documentType: DocumentType;
  documentTypeLabel: string;
  confidence: number;
  metadata: DocumentMetadata;
  tags: string[];
  uploadedAt: string;
  summary: string;
}

const documentTypeIcons: Record<DocumentType, typeof FileText> = {
  discharge_summary: ClipboardList,
  lab_report: FlaskConical,
  imaging_report: FileImage,
  operative_note: Stethoscope,
  insurance_letter: Receipt,
  prescription: FileText,
  referral: FileCheck,
  progress_note: FileText,
  unknown: FileText,
};

const documentTypeColors: Record<DocumentType, string> = {
  discharge_summary: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  lab_report: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  imaging_report: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  operative_note: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  insurance_letter: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  prescription: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  referral: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  progress_note: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
  unknown: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
};

function DocumentCard({ doc }: { doc: TaggedDocument }) {
  const Icon = documentTypeIcons[doc.documentType] || FileText;
  const colorClass = documentTypeColors[doc.documentType] || documentTypeColors.unknown;

  return (
    <AccordionItem value={doc.id} className="border rounded-lg px-3 mb-2">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-3 w-full">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate max-w-[200px]">{doc.filename}</p>
              {doc.confidence >= 90 && (
                <Check className="h-3 w-3 text-green-500" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{doc.documentTypeLabel}</Badge>
              {doc.metadata.date && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(doc.metadata.date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">{doc.confidence}% match</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <div className="space-y-3 pl-11">
          <p className="text-sm text-muted-foreground">{doc.summary}</p>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            {doc.metadata.facility && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span>{doc.metadata.facility}</span>
              </div>
            )}
            {doc.metadata.provider && (
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span>{doc.metadata.provider}</span>
              </div>
            )}
            {doc.metadata.testName && (
              <div className="flex items-center gap-2">
                <FlaskConical className="h-3 w-3 text-muted-foreground" />
                <span>{doc.metadata.testName}</span>
              </div>
            )}
            {doc.metadata.bodyPart && (
              <div className="flex items-center gap-2">
                <Heart className="h-3 w-3 text-muted-foreground" />
                <span>{doc.metadata.bodyPart}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {doc.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Uploaded {new Date(doc.uploadedAt).toLocaleString()}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function UploadProgress({ filename, stage }: { filename: string; stage: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-sm font-medium">{filename}</span>
      </div>
      <Progress value={stage === "classifying" ? 60 : stage === "extracting" ? 80 : 100} className="h-1" />
      <p className="text-xs text-muted-foreground">
        {stage === "uploading" && "Uploading document..."}
        {stage === "classifying" && "AI is classifying document type..."}
        {stage === "extracting" && "Extracting metadata and tags..."}
        {stage === "complete" && "Processing complete!"}
      </p>
    </div>
  );
}

export function DocumentAutoTagging() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadFilename, setUploadFilename] = useState<string>("");
  const [filterType, setFilterType] = useState<DocumentType | "all">("all");

  const { data: documents, isLoading } = useQuery<TaggedDocument[]>({
    queryKey: ["/api/documents/tagged"],
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadFilename(file.name);
      setUploadStage("uploading");

      await new Promise(r => setTimeout(r, 500));
      setUploadStage("classifying");

      const response = await apiRequest("POST", "/api/documents/upload-and-tag", {
        filename: file.name,
      });

      if (!response.ok) throw new Error("Upload failed");

      setUploadStage("extracting");
      await new Promise(r => setTimeout(r, 500));

      const result = await response.json();
      setUploadStage("complete");

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/tagged"] });
      toast({
        title: "Document Tagged",
        description: `${data.document.documentTypeLabel} - ${data.document.tags.slice(0, 2).join(", ")}`,
      });
      setTimeout(() => setUploadStage(null), 1500);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Unable to process document. Please try again.",
        variant: "destructive",
      });
      setUploadStage(null);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  }, [uploadMutation]);

  const filteredDocs = filterType === "all" 
    ? documents 
    : documents?.filter(d => d.documentType === filterType);

  const documentCounts = documents?.reduce((acc, doc) => {
    acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-document-tagging">
          <Tag className="h-4 w-4" />
          Smart Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Document Auto-Label
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          <div className="p-4 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
            <label className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Drop a PDF or click to upload</span>
              <span className="text-xs text-muted-foreground">AI will automatically classify and tag your document</span>
              <Input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
                data-testid="input-document-upload"
              />
            </label>
          </div>

          {uploadStage && (
            <UploadProgress filename={uploadFilename} stage={uploadStage} />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
              data-testid="filter-all"
            >
              All ({documents?.length || 0})
            </Button>
            {Object.entries(documentCounts).map(([type, count]) => (
              <Button
                key={type}
                variant={filterType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(type as DocumentType)}
                data-testid={`filter-${type}`}
              >
                {documentTypeLabels[type as DocumentType] || type} ({count})
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : filteredDocs && filteredDocs.length > 0 ? (
            <ScrollArea className="h-[350px]">
              <Accordion type="single" collapsible className="space-y-2">
                {filteredDocs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </Accordion>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No documents yet</p>
              <p className="text-sm text-muted-foreground">Upload a document to see AI auto-labeling in action</p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">AI-Powered Organization</p>
                <p>Documents are automatically classified into categories and tagged with relevant metadata for easy searching and filtering.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const documentTypeLabels: Record<DocumentType, string> = {
  discharge_summary: "Discharge Summary",
  lab_report: "Lab Report",
  imaging_report: "Imaging Report",
  operative_note: "Operative Note",
  insurance_letter: "Insurance Letter",
  prescription: "Prescription",
  referral: "Referral",
  progress_note: "Progress Note",
  unknown: "Unknown",
};

export function DocumentAutoTaggingCard() {
  return (
    <Card data-testid="card-document-tagging">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="h-5 w-5 text-primary" />
          Smart Documents
        </CardTitle>
        <CardDescription>AI-powered document organization</CardDescription>
      </CardHeader>
      <CardContent>
        <DocumentAutoTagging />
        <p className="text-xs text-muted-foreground mt-2">
          Upload PDFs and let AI classify and tag them automatically
        </p>
      </CardContent>
    </Card>
  );
}
