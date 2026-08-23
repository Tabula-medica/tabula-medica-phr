import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AIThinkingDisplay } from "@/components/ai-thinking-display";
import {
  Camera, Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  Receipt, TestTube, Pill, CreditCard, X, ImageIcon, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

type DocumentType = "hospital_bill" | "lab_result" | "prescription" | "insurance_card" | "unknown";

interface ParseResult {
  documentType: string;
  confidence: number;
  thinking: string;
  extractedData: Record<string, any>;
  warnings: Array<{ field: string; message: string; severity: string; suggestedAction: string }>;
  ocrQuality: { overallScore: number; issues: string[] };
  noCdsDisclaimer: string;
  fhirResourceCount?: number;
  fhirResources?: any[];
}

interface DocumentScannerProps {
  onResult?: (result: ParseResult) => void;
  anonymous?: boolean;
  className?: string;
}

const DOC_TYPES: Array<{ value: DocumentType; label: string; icon: typeof Receipt; description: string }> = [
  { value: "hospital_bill", label: "Hospital Bill", icon: Receipt, description: "Medical bills, invoices, EOBs" },
  { value: "lab_result", label: "Lab Result", icon: TestTube, description: "Blood work, urinalysis, panels" },
  { value: "prescription", label: "Prescription", icon: Pill, description: "Rx labels, prescription pads" },
  { value: "insurance_card", label: "Insurance Card", icon: CreditCard, description: "Front or back of card" },
  { value: "unknown", label: "Auto-Detect", icon: FileText, description: "Let AI identify the document" },
];

export function DocumentScanner({ onResult, anonymous = false, className }: DocumentScannerProps) {
  const [selectedType, setSelectedType] = useState<DocumentType>("unknown");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum size is 20 MB.");
      return;
    }

    setFileName(file.name);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleParse = async () => {
    if (!preview) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const base64 = preview.split(",")[1];
      const mimeMatch = preview.match(/data:([^;]+);/);
      const mimeType = mimeMatch?.[1] || "image/jpeg";

      const endpoint = anonymous ? "/api/multimodal/parse-anonymous" : "/api/multimodal/parse";
      const response = await apiRequest("POST", endpoint, {
        imageData: base64,
        mimeType,
        documentType: selectedType,
      });

      const data = await response.json();
      setResult(data);
      onResult?.(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse document");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearDocument = () => {
    setPreview(null);
    setFileName("");
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="document-scanner">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="h-5 w-5 text-primary" />
          Smart Document Scanner
        </CardTitle>
        <CardDescription>
          Snap a photo of any medical document — bills, lab results, prescriptions, or insurance cards. AI extracts structured data instantly.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as DocumentType)}>
            <SelectTrigger className="w-full" data-testid="select-doc-type">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((dt) => (
                <SelectItem key={dt.value} value={dt.value} data-testid={`select-doctype-${dt.value}`}>
                  <div className="flex items-center gap-2">
                    <dt.icon className="h-4 w-4" />
                    <div>
                      <span className="font-medium">{dt.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{dt.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!preview ? (
          <div role="presentation"
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Drop a photo or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">JPEG, PNG, WebP, HEIC — up to 20 MB</p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  data-testid="button-upload-file"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  data-testid="button-take-photo"
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  Take Photo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border bg-muted/30">
              <img
                src={preview}
                alt="Document preview"
                className="w-full max-h-64 object-contain"
                data-testid="img-document-preview"
              />
              <button
                onClick={clearDocument}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border hover:bg-destructive/10 transition-colors"
                data-testid="button-clear-document"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {fileName && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-xs text-muted-foreground">
                  {fileName}
                </div>
              )}
            </div>

            <Button
              onClick={handleParse}
              disabled={isProcessing}
              className="w-full gap-2"
              data-testid="button-parse-document"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract Data with AI
                </>
              )}
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-camera-capture"
        />

        {isProcessing && (
          <div className="space-y-2" data-testid="parsing-progress">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Running multimodal OCR analysis...</span>
            </div>
            <Progress value={undefined} className="h-1.5" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20" data-testid="parse-error">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {result && <DocumentParseResult result={result} />}
      </CardContent>
    </Card>
  );
}

function DocumentParseResult({ result }: { result: ParseResult }) {
  const confidencePercent = Math.round(result.confidence * 100);
  const qualityPercent = Math.round(result.ocrQuality.overallScore * 100);

  return (
    <div className="space-y-3" data-testid="parse-result">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Extraction Complete</span>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs" data-testid="badge-doc-type">
            {result.documentType.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant={confidencePercent >= 80 ? "default" : "secondary"}
            className={cn("text-xs", confidencePercent < 60 && "bg-amber-500/10 text-amber-600 border-amber-500/20")}
            data-testid="badge-confidence"
          >
            {confidencePercent}% confidence
          </Badge>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>OCR Quality: {qualityPercent}%</span>
        {result.fhirResourceCount !== undefined && (
          <span>{result.fhirResourceCount} FHIR resource(s) generated</span>
        )}
      </div>

      {result.thinking && (
        <AIThinkingDisplay thinking={result.thinking} label="How AI parsed this document" />
      )}

      {result.warnings.length > 0 && (
        <div className="space-y-1.5">
          {result.warnings.map((w, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 text-xs p-2 rounded-lg",
                w.severity === "high" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              )}
              data-testid={`warning-${idx}`}
            >
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{w.message}</span>
                {w.suggestedAction && <p className="mt-0.5 opacity-80">{w.suggestedAction}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          Extracted Data
        </div>
        <div className="p-3 max-h-64 overflow-auto">
          <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono" data-testid="extracted-data-json">
            {JSON.stringify(result.extractedData, null, 2)}
          </pre>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic" data-testid="text-nocds-disclaimer">
        {result.noCdsDisclaimer}
      </p>
    </div>
  );
}
