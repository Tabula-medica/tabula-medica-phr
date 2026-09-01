import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTefcaEnabled } from "@/hooks/use-tefca";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload,
  FileText,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  File,
  X,
  Hospital,
  Smartphone,
  Shield,
  ArrowRight,
} from "lucide-react";
import { SiApple } from "react-icons/si";

interface HealthPlatform {
  id: string;
  name: string;
  description: string;
  icon: typeof Hospital;
  connected?: boolean;
  popular?: boolean;
}

const HEALTH_PLATFORMS: HealthPlatform[] = [
  {
    id: "fasten_health",
    name: "Fasten Health",
    description: "Connect to 25,000+ US healthcare providers",
    icon: Hospital,
    popular: true,
  },
  {
    id: "apple_health",
    name: "Apple Health",
    description: "Import from your iPhone health data",
    icon: Smartphone,
  },
  {
    id: "cms_bluebutton",
    name: "Medicare Blue Button",
    description: "CMS Medicare claims and coverage",
    icon: Shield,
  },
];

const SUPPORTED_FILE_TYPES = [
  { extension: ".pdf", description: "Medical documents, lab reports" },
  { extension: ".xml", description: "CCD/C-CDA clinical documents" },
  { extension: ".json", description: "FHIR bundles" },
  { extension: ".jpg/.png", description: "Scanned documents, images" },
];

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  documentId?: string;
}

interface HealthRecordImportProps {
  profileId?: string;
  onComplete?: () => void;
  onFilesUploaded?: (count: number) => void;
  onPlatformConnected?: (platformId: string) => void;
}

export function HealthRecordImport({
  profileId,
  onComplete,
  onFilesUploaded,
  onPlatformConnected,
}: HealthRecordImportProps) {
  const { toast } = useToast();
  const tefcaEnabled = useTefcaEnabled();
  // Fasten Health is the TEFCA connector (US-only); hide it on .world.
  const platforms = HEALTH_PLATFORMS.filter((p) => tefcaEnabled || p.id !== "fasten_health");
  const [activeTab, setActiveTab] = useState("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("type", getFileType(file.name));
      if (profileId) formData.append("profileId", profileId);
      
      const response = await fetch("/api/documents/ocr/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Upload failed");
      }
      
      return response.json();
    },
  });

  function getFileType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'xml': return 'ccd';
      case 'json': return 'other';
      case 'jpg':
      case 'jpeg':
      case 'png': return 'imaging_report';
      default: return 'other';
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map(file => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: "uploading", progress: 0 } : f
      ));

      try {
        const progressInterval = setInterval(() => {
          setFiles(prev => prev.map((f, idx) => 
            idx === i && f.status === "uploading" 
              ? { ...f, progress: Math.min(f.progress + 10, 90) } 
              : f
          ));
        }, 200);

        const result = await uploadMutation.mutateAsync(files[i].file);
        
        clearInterval(progressInterval);
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "success", progress: 100, documentId: result.id } : f
        ));
        successCount++;
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "error", error: "Upload failed" } : f
        ));
      }
    }

    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully`,
      });
      onFilesUploaded?.(successCount);
    }
  };

  const connectPlatform = async (platform: HealthPlatform) => {
    setConnectingPlatform(platform.id);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Connection initiated",
        description: `You'll be redirected to ${platform.name} to authorize access`,
      });
      
      onPlatformConnected?.(platform.id);
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setConnectingPlatform(null);
    }
  };

  const pendingFiles = files.filter(f => f.status === "pending");
  const hasCompletedFiles = files.some(f => f.status === "success");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          Import Health Records
        </CardTitle>
        <CardDescription>
          Upload documents or connect to your health provider portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Upload Files
            </TabsTrigger>
            <TabsTrigger value="connect" data-testid="tab-connect">
              <Link2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Connect Portal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {/* Drag-and-drop is a pointer shortcut for the "Browse Files"
                button below, which wraps a real file input. The zone itself
                is layout, so it carries no role and takes no tab stop. */}
            <div
              role="presentation"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-lg font-medium mb-2">
                Drag and drop files here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse your computer
              </p>
              <Input
                type="file"
                multiple
                accept=".pdf,.xml,.json,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
              />
              <Label htmlFor="file-upload">
                <Button variant="outline" asChild className="cursor-pointer">
                  <span>Browse Files</span>
                </Button>
              </Label>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUPPORTED_FILE_TYPES.map(type => (
                <Badge key={type.extension} variant="secondary" className="text-xs">
                  {type.extension}: {type.description}
                </Badge>
              ))}
            </div>

            {files.length > 0 && (
              <div className="space-y-2 mt-4">
                <FieldCaption>Selected Files</FieldCaption>
                {files.map((uploadedFile, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <File className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.file.size / 1024).toFixed(1)} KB
                      </p>
                      {uploadedFile.status === "uploading" && (
                        <Progress value={uploadedFile.progress} className="h-1 mt-1" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadedFile.status === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Upload successful" />
                      )}
                      {uploadedFile.status === "error" && (
                        <AlertCircle className="h-5 w-5 text-destructive" aria-label="Upload failed" />
                      )}
                      {uploadedFile.status === "uploading" && (
                        <Loader2 className="h-5 w-5 animate-spin" aria-label="Uploading" />
                      )}
                      {uploadedFile.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          aria-label="Remove file"
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {pendingFiles.length > 0 && (
                  <Button 
                    onClick={uploadFiles}
                    className="w-full mt-4"
                    disabled={uploadMutation.isPending}
                    data-testid="button-upload-files"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                        Upload {pendingFiles.length} File{pendingFiles.length > 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {hasCompletedFiles && (
              <Alert className="mt-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your documents have been uploaded and are being processed. 
                  They will appear in your health records shortly.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="connect" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Connecting to a health portal allows automatic import of your records.
                Your data is encrypted and you control what information is shared.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {platforms.map(platform => {
                const Icon = platform.icon;
                const isConnecting = connectingPlatform === platform.id;
                
                return (
                  <div
                    key={platform.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover-elevate"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      {platform.id === "apple_health" ? (
                        <SiApple className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{platform.name}</p>
                        {platform.popular && (
                          <Badge variant="secondary" className="text-xs">Popular</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {platform.description}
                      </p>
                    </div>
                    <Button
                      variant={platform.connected ? "secondary" : "outline"}
                      onClick={() => connectPlatform(platform)}
                      disabled={isConnecting}
                      data-testid={`button-connect-${platform.id}`}
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : platform.connected ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                          Connected
                        </>
                      ) : (
                        <>
                          Connect
                          <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-muted-foreground text-center mt-4">
              Don't see your provider? You can still upload documents manually.
            </p>
          </TabsContent>
        </Tabs>

        {(hasCompletedFiles || files.some(f => f.status === "success")) && onComplete && (
          <div className="flex justify-end mt-6">
            <Button onClick={onComplete} data-testid="button-continue-after-import">
              Continue
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
