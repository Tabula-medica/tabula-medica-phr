import { useState, useRef, useCallback } from "react";
import { createWorker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Upload, FileText, Loader2, X, Copy, Check, ImageIcon } from "lucide-react";

interface OcrScannerProps {
  onTextExtracted: (text: string) => void;
  label?: string;
  compact?: boolean;
}

export function OcrScanner({ onTextExtracted, label = "Scan Document", compact = false }: OcrScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setProgressLabel("Initializing OCR...");
    setExtractedText("");

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
            setProgressLabel("Recognizing text...");
          } else if (m.status === "loading language traineddata") {
            setProgressLabel("Loading language data...");
            setProgress(10);
          }
        },
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      const cleaned = text.trim();
      setExtractedText(cleaned);
      setProgress(100);
      setProgressLabel("Complete");

      if (cleaned) {
        onTextExtracted(cleaned);
      }
    } catch {
      setProgressLabel("OCR failed. Please try a clearer image.");
    } finally {
      setIsProcessing(false);
    }
  }, [onTextExtracted]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = "";
  }, [processImage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setExtractedText("");
    setPreviewUrl(null);
    setProgress(0);
    setProgressLabel("");
  };

  if (compact && !isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        aria-label={label}
        data-testid="button-ocr-scan"
      >
        <Camera className="w-4 h-4 mr-1" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>
    );
  }

  return (
    <Card className="border-indigo-500/20 bg-indigo-500/5" role="region" aria-label="Document Scanner">
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          {label}
        </CardTitle>
        {compact && (
          <Button variant="ghost" size="sm" onClick={() => { setIsOpen(false); handleClear(); }} aria-label="Close scanner">
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            aria-label="Take photo of document"
            data-testid="button-ocr-camera"
          >
            <Camera className="w-4 h-4 mr-1" aria-hidden="true" /> Camera
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            aria-label="Upload document image"
            data-testid="button-ocr-upload"
          >
            <Upload className="w-4 h-4 mr-1" aria-hidden="true" /> Upload
          </Button>
          {extractedText && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              aria-label={copied ? "Copied to clipboard" : "Copy extracted text"}
              data-testid="button-ocr-copy"
            >
              {copied ? <Check className="w-4 h-4 mr-1 text-green-500" aria-hidden="true" /> : <Copy className="w-4 h-4 mr-1" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          {(extractedText || previewUrl) && (
            <Button size="sm" variant="ghost" onClick={handleClear} aria-label="Clear scan results" data-testid="button-ocr-clear">
              <X className="w-4 h-4 mr-1" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>

        {isProcessing && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">{progressLabel}</span>
            </div>
            <Progress value={progress} aria-label={`OCR progress: ${progress}%`} />
          </div>
        )}

        {previewUrl && !isProcessing && (
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded border overflow-hidden shrink-0">
              <img src={previewUrl} alt="Scanned document preview" className="w-full h-full object-cover" />
            </div>
            {extractedText && (
              <ScrollArea className="flex-1 max-h-32 border rounded p-2 bg-background">
                <p className="text-xs whitespace-pre-wrap font-mono" data-testid="text-ocr-result">{extractedText}</p>
              </ScrollArea>
            )}
          </div>
        )}

        {!previewUrl && !isProcessing && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ImageIcon className="w-3 h-3" aria-hidden="true" />
            Take a photo or upload an image of your insurance card, medical records, or prescriptions.
          </p>
        )}

        <Badge variant="outline" className="text-[10px]">
          <span aria-hidden="true">🔒</span> Images are processed locally on your device — never uploaded to any server.
        </Badge>
      </CardContent>
    </Card>
  );
}
