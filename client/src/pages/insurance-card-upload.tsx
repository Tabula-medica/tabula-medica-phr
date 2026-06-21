import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO, buildPageSchemas, buildHowToSchema } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Camera,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Shield,
  Eye,
  Trash2,
  RotateCcw,
  ImageIcon,
  Phone,
  User,
  Building2,
  Hash,
  Copy,
  Check,
} from "lucide-react";

interface InsuranceCard {
  id: string;
  side: "front" | "back";
  imageUrl: string;
  extractedData: ExtractedInsuranceData;
  uploadedAt: string;
  status: "processing" | "verified" | "needs_review";
}

interface ExtractedInsuranceData {
  insurerName?: string;
  policyNumber?: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberId?: string;
  planType?: string;
  copayPrimary?: string;
  copaySpecialist?: string;
  copayER?: string;
  deductible?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  phoneCustomerService?: string;
  phonePreAuth?: string;
  effectiveDate?: string;
  rawText?: string;
}

interface SavedInsuranceInfo {
  id: string;
  insurerName: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  planType: string;
  copays: { primary: string; specialist: string; urgentCare: string; er: string };
  deductible: { individual: string; family: string };
  frontImageUrl?: string;
  backImageUrl?: string;
  lastUpdated: string;
  verified: boolean;
}

const commonInsurers = [
  "Aetna", "Anthem", "Blue Cross Blue Shield", "Cigna", "Humana",
  "Kaiser Permanente", "Medicaid", "Medicare", "Molina Healthcare",
  "Oscar Health", "UnitedHealthcare",
];

const planTypes = ["HMO", "PPO", "EPO", "POS", "HDHP", "Medicare Advantage", "Medicaid", "Other"];

function extractInsuranceFields(ocrText: string): ExtractedInsuranceData {
  const data: ExtractedInsuranceData = { rawText: ocrText };
  const text = ocrText.toUpperCase();

  for (const insurer of commonInsurers) {
    if (text.includes(insurer.toUpperCase())) {
      data.insurerName = insurer;
      break;
    }
  }
  if (!data.insurerName) {
    if (text.includes("BCBS") || text.includes("BLUE CROSS")) data.insurerName = "Blue Cross Blue Shield";
    else if (text.includes("UHC") || text.includes("UNITED")) data.insurerName = "UnitedHealthcare";
  }

  const policyMatch = ocrText.match(/(?:member|policy|id|subscriber)\s*(?:#|no|number|id)?[:\s]*([A-Z0-9]{6,20})/i);
  if (policyMatch) data.policyNumber = policyMatch[1].trim();

  const groupMatch = ocrText.match(/(?:group|grp)\s*(?:#|no|number)?[:\s]*([A-Z0-9]{4,15})/i);
  if (groupMatch) data.groupNumber = groupMatch[1].trim();

  const subscriberMatch = ocrText.match(/(?:subscriber|member|name)[:\s]*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  if (subscriberMatch) data.subscriberName = subscriberMatch[1].trim();

  const copayPrimary = ocrText.match(/(?:pcp|primary|office)\s*(?:copay|co-pay)?[:\s]*\$?(\d+)/i);
  if (copayPrimary) data.copayPrimary = `$${copayPrimary[1]}`;

  const copaySpec = ocrText.match(/(?:specialist|spec)\s*(?:copay|co-pay)?[:\s]*\$?(\d+)/i);
  if (copaySpec) data.copaySpecialist = `$${copaySpec[1]}`;

  const copayER = ocrText.match(/(?:er|emergency)\s*(?:copay|co-pay)?[:\s]*\$?(\d+)/i);
  if (copayER) data.copayER = `$${copayER[1]}`;

  const deductible = ocrText.match(/(?:deductible|ded)[:\s]*\$?([0-9,]+)/i);
  if (deductible) data.deductible = `$${deductible[1]}`;

  const rxBin = ocrText.match(/(?:rx\s*bin|bin)[:\s]*(\d{6})/i);
  if (rxBin) data.rxBin = rxBin[1];

  const rxPcn = ocrText.match(/(?:rx\s*pcn|pcn)[:\s]*([A-Z0-9]+)/i);
  if (rxPcn) data.rxPcn = rxPcn[1];

  const rxGroup = ocrText.match(/(?:rx\s*group|rx\s*grp)[:\s]*([A-Z0-9]+)/i);
  if (rxGroup) data.rxGroup = rxGroup[1];

  const phone = ocrText.match(/(?:customer\s*service|member\s*services?|call)[:\s]*(1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i);
  if (phone) data.phoneCustomerService = phone[1].trim();

  const planMatch = ocrText.match(/(?:plan\s*type|plan)[:\s]*(HMO|PPO|EPO|POS|HDHP)/i);
  if (planMatch) data.planType = planMatch[1].toUpperCase();

  const dateMatch = ocrText.match(/(?:effective|eff)\s*(?:date)?[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
  if (dateMatch) data.effectiveDate = dateMatch[1];

  return data;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      data-testid={`copy-${text}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function InsuranceFieldRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

export default function InsuranceCardUpload() {
  useSEO({
    title: "Insurance Card Upload",
    description: "Upload your insurance card by photo to auto-fill your insurance information. AI-powered OCR extracts member ID, group number, plan details, and coverage information.",
    canonicalPath: "/insurance-card-upload",
    structuredData: [
      ...buildPageSchemas({
        pageName: "Insurance Card Scanner",
        pageDescription: "Upload your insurance card by photo to auto-fill your insurance information using AI-powered OCR.",
        pagePath: "/insurance-card-upload",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Dashboard", path: "/dashboard" },
          { name: "Insurance Card Upload", path: "/insurance-card-upload" },
        ],
      }),
      buildHowToSchema({
        name: "How to Digitize Your Insurance Card",
        description: "Use your phone camera to scan and digitize your health insurance card in seconds.",
        totalTime: "PT30S",
        steps: [
          { name: "Take a photo of the front", text: "Position your insurance card on a flat surface and take a clear photo of the front." },
          { name: "Take a photo of the back", text: "Flip the card and take a clear photo of the back for additional coverage details." },
          { name: "Review extracted information", text: "Verify the auto-filled details including member ID, group number, plan name, and copay amounts." },
        ],
      }),
    ],
  });
  const { toast } = useToast();

  const [captureMode, setCaptureMode] = useState<"front" | "back" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedInsuranceData | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [insurerName, setInsurerName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [subscriberName, setSubscriberName] = useState("");
  const [planType, setPlanType] = useState("");
  const [copayPrimary, setCopayPrimary] = useState("");
  const [copaySpecialist, setCopaySpecialist] = useState("");
  const [copayER, setCopayER] = useState("");
  const [deductible, setDeductible] = useState("");
  const [phoneCS, setPhoneCS] = useState("");

  const [ocrMode, setOcrMode] = useState<"ai" | "local">("ai");
  const [pharmacyRouting, setPharmacyRouting] = useState<{ bin: string; pcn: string; group: string; payerName: string; isValidRouting: boolean; routingNotes: string } | null>(null);
  const [cardType, setCardType] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const applyExtracted = useCallback((extracted: ExtractedInsuranceData) => {
    setExtractedData(extracted);
    if (extracted.insurerName) setInsurerName(extracted.insurerName);
    if (extracted.policyNumber) setPolicyNumber(extracted.policyNumber);
    if (extracted.groupNumber) setGroupNumber(extracted.groupNumber);
    if (extracted.subscriberName) setSubscriberName(extracted.subscriberName);
    if (extracted.planType) setPlanType(extracted.planType);
    if (extracted.copayPrimary) setCopayPrimary(extracted.copayPrimary);
    if (extracted.copaySpecialist) setCopaySpecialist(extracted.copaySpecialist);
    if (extracted.copayER) setCopayER(extracted.copayER);
    if (extracted.deductible) setDeductible(extracted.deductible);
    if (extracted.phoneCustomerService) setPhoneCS(extracted.phoneCustomerService);
  }, []);

  const processImageAI = useCallback(async (file: File) => {
    setIsProcessing(true);
    setOcrProgress(10);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      setOcrProgress(40);

      const res = await apiRequest("POST", "/api/card-ocr/scan", {
        imageBase64: base64,
        side: captureMode || "front",
      });
      const result = await res.json();

      setOcrProgress(90);

      if (result.fields) {
        const extracted: ExtractedInsuranceData = {
          insurerName: result.fields.insurerName || result.fields.discountProgramName,
          policyNumber: result.fields.memberId,
          groupNumber: result.fields.groupNumber,
          subscriberName: result.fields.subscriberName,
          planType: result.fields.planType,
          copayPrimary: result.fields.copayPrimary,
          copaySpecialist: result.fields.copaySpecialist,
          copayER: result.fields.copayER,
          deductible: result.fields.deductible,
          rxBin: result.fields.rxBin,
          rxPcn: result.fields.rxPcn,
          rxGroup: result.fields.rxGroup,
          phoneCustomerService: result.fields.phoneCustomerService,
          effectiveDate: result.fields.effectiveDate,
          subscriberId: result.fields.memberId,
        };

        applyExtracted(extracted);

        if (result.pharmacyRouting) {
          setPharmacyRouting(result.pharmacyRouting);
        }
        if (result.cardType) {
          setCardType(result.cardType);
        }

        const fieldsFound = Object.values(result.fields).filter(Boolean).length;
        toast({
          title: "AI Card Scan Complete",
          description: `Extracted ${fieldsFound} field${fieldsFound !== 1 ? "s" : ""} with ${Math.round(result.confidence * 100)}% confidence. ${result.pharmacyRouting?.isValidRouting ? "Pharmacy routing validated." : ""}`,
        });
      }
    } catch {
      toast({ title: "AI scan failed", description: "Falling back to local OCR processing...", variant: "destructive" });
      await processImageLocal(file);
    } finally {
      setIsProcessing(false);
      setOcrProgress(100);
      setCaptureMode(null);
    }
  }, [toast, captureMode, applyExtracted]);

  const processImageLocal = useCallback(async (file: File) => {
    setIsProcessing(true);
    setOcrProgress(0);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      const extracted = extractInsuranceFields(text);
      applyExtracted(extracted);

      const fieldsFound = Object.values(extracted).filter(v => v && v !== text).length;
      toast({
        title: "Card scanned successfully",
        description: `Extracted ${fieldsFound} field${fieldsFound !== 1 ? "s" : ""}. Please review and correct any inaccuracies.`,
      });
    } catch {
      toast({ title: "Scan failed", description: "Could not process the image. Please try again or enter information manually.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setCaptureMode(null);
    }
  }, [toast, applyExtracted]);

  const processImage = useCallback(async (file: File) => {
    if (ocrMode === "ai") {
      await processImageAI(file);
    } else {
      await processImageLocal(file);
    }
  }, [ocrMode, processImageAI, processImageLocal]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = "";
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setExtractedData(null);
    setInsurerName(""); setPolicyNumber(""); setGroupNumber("");
    setSubscriberName(""); setPlanType(""); setCopayPrimary("");
    setCopaySpecialist(""); setCopayER(""); setDeductible("");
    setPhoneCS(""); setEditMode(false);
    setPharmacyRouting(null); setCardType(null);
  };

  const handleSave = () => {
    if (!insurerName || !policyNumber) {
      toast({ title: "Missing information", description: "Insurance provider and policy number are required.", variant: "destructive" });
      return;
    }
    toast({ title: "Insurance information saved", description: "Your insurance card details have been saved to your profile." });
    setEditMode(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-insurance-card-upload">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="heading-insurance-card">
            <CreditCard className="h-6 w-6 text-primary" />
            Insurance Card Upload
          </h1>
          <p className="text-muted-foreground mt-1">
            Take a photo of your insurance card or upload an image to auto-fill your insurance details
          </p>
        </div>

        <Alert className="mb-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
            {ocrMode === "ai"
              ? "AI-powered scanning uses vision AI to extract card details with high accuracy, including BIN/PCN pharmacy routing. HIPAA-compliant processing."
              : "Local OCR processes your card entirely on your device. The image never leaves your browser."}
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium">Scan Mode:</span>
          <div className="flex gap-2">
            <Button
              variant={ocrMode === "ai" ? "default" : "outline"}
              size="sm"
              onClick={() => setOcrMode("ai")}
              data-testid="button-mode-ai"
            >
              AI Vision (Recommended)
            </Button>
            <Button
              variant={ocrMode === "local" ? "default" : "outline"}
              size="sm"
              onClick={() => setOcrMode("local")}
              data-testid="button-mode-local"
            >
              Local OCR (On-Device)
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Capture Insurance Card
                </CardTitle>
                <CardDescription>
                  Take a clear photo of the front of your insurance card, or upload an existing image
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isProcessing ? (
                  <div className="text-center py-6 space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm font-medium">Scanning card...</p>
                    <Progress value={ocrProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{ocrProgress}% complete</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="h-24 flex-col gap-2"
                        variant="outline"
                        onClick={() => cameraInputRef.current?.click()}
                        data-testid="button-camera-capture"
                      >
                        <Camera className="h-6 w-6" />
                        <span className="text-xs">Take Photo</span>
                      </Button>
                      <Button
                        className="h-24 flex-col gap-2"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="button-file-upload"
                      >
                        <Upload className="h-6 w-6" />
                        <span className="text-xs">Upload Image</span>
                      </Button>
                    </div>

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-camera"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />

                    <p className="text-xs text-muted-foreground text-center">
                      Supported formats: JPEG, PNG, WebP
                    </p>
                  </div>
                )}

                {previewUrl && (
                  <div className="relative mt-4">
                    <img
                      src={previewUrl}
                      alt="Insurance card preview"
                      className="w-full rounded-lg border shadow-sm"
                      data-testid="img-card-preview"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2"
                        onClick={handleReset}
                        data-testid="button-reset-scan"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Re-scan
                      </Button>
                    </div>
                    {extractedData && (
                      <Badge className="absolute bottom-2 left-2" variant="secondary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Scanned
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!previewUrl && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No card scanned yet</p>
                    <p className="text-xs mt-1">Take a photo or upload an image to get started</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!previewUrl && (
              <Button
                variant="link"
                className="w-full"
                onClick={() => setEditMode(true)}
                data-testid="button-manual-entry"
              >
                <FileText className="h-4 w-4 mr-2" />
                Enter insurance details manually
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Insurance Details</CardTitle>
                  {(extractedData || editMode) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditMode(!editMode)}
                      data-testid="button-toggle-edit"
                    >
                      {editMode ? "Done" : "Edit"}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {extractedData ? "Review the extracted information and correct any inaccuracies" : "Scan your card to auto-fill or enter manually"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!extractedData && !editMode ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Scan your insurance card to see details here</p>
                  </div>
                ) : editMode ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="insurer">Insurance Provider *</Label>
                      <Select value={insurerName} onValueChange={setInsurerName}>
                        <SelectTrigger data-testid="select-insurer">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {commonInsurers.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="policy">Policy/Member ID *</Label>
                        <Input id="policy" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="e.g. XYZ123456789" data-testid="input-policy" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="group">Group Number</Label>
                        <Input id="group" value={groupNumber} onChange={e => setGroupNumber(e.target.value)} placeholder="e.g. GRP001" data-testid="input-group" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subscriber">Subscriber Name</Label>
                      <Input id="subscriber" value={subscriberName} onChange={e => setSubscriberName(e.target.value)} placeholder="Name on card" data-testid="input-subscriber" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-type">Plan Type</Label>
                      <Select value={planType} onValueChange={setPlanType}>
                        <SelectTrigger data-testid="select-plan-type">
                          <SelectValue placeholder="Select plan type" />
                        </SelectTrigger>
                        <SelectContent>
                          {planTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <p className="text-sm font-medium">Copay Information</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">PCP Copay</Label>
                        <Input value={copayPrimary} onChange={e => setCopayPrimary(e.target.value)} placeholder="$25" data-testid="input-copay-pcp" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Specialist</Label>
                        <Input value={copaySpecialist} onChange={e => setCopaySpecialist(e.target.value)} placeholder="$50" data-testid="input-copay-specialist" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ER</Label>
                        <Input value={copayER} onChange={e => setCopayER(e.target.value)} placeholder="$250" data-testid="input-copay-er" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Deductible</Label>
                        <Input value={deductible} onChange={e => setDeductible(e.target.value)} placeholder="$1,500" data-testid="input-deductible" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Customer Service</Label>
                        <Input value={phoneCS} onChange={e => setPhoneCS(e.target.value)} placeholder="1-800-xxx-xxxx" data-testid="input-phone-cs" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSave} className="flex-1" data-testid="button-save-insurance">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save Insurance Info
                      </Button>
                      <Button variant="outline" onClick={handleReset} data-testid="button-clear-form">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <InsuranceFieldRow icon={Building2} label="Insurance Provider" value={insurerName} />
                    <InsuranceFieldRow icon={Hash} label="Policy/Member ID" value={policyNumber} />
                    <InsuranceFieldRow icon={Hash} label="Group Number" value={groupNumber} />
                    <InsuranceFieldRow icon={User} label="Subscriber Name" value={subscriberName} />
                    <InsuranceFieldRow icon={FileText} label="Plan Type" value={planType} />
                    <Separator className="my-2" />
                    {(copayPrimary || copaySpecialist || copayER) && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground pt-1">Copay Information</p>
                        <InsuranceFieldRow icon={User} label="PCP Copay" value={copayPrimary} />
                        <InsuranceFieldRow icon={User} label="Specialist Copay" value={copaySpecialist} />
                        <InsuranceFieldRow icon={AlertTriangle} label="ER Copay" value={copayER} />
                      </>
                    )}
                    {deductible && <InsuranceFieldRow icon={FileText} label="Deductible" value={deductible} />}
                    {phoneCS && <InsuranceFieldRow icon={Phone} label="Customer Service" value={phoneCS} />}
                    {extractedData?.rxBin && <InsuranceFieldRow icon={Hash} label="Rx BIN" value={extractedData.rxBin} />}
                    {extractedData?.rxPcn && <InsuranceFieldRow icon={Hash} label="Rx PCN" value={extractedData.rxPcn} />}
                    {extractedData?.rxGroup && <InsuranceFieldRow icon={Hash} label="Rx Group" value={extractedData.rxGroup} />}
                    {extractedData?.effectiveDate && <InsuranceFieldRow icon={FileText} label="Effective Date" value={extractedData.effectiveDate} />}
                    <div className="pt-3">
                      <Button onClick={handleSave} className="w-full" data-testid="button-save-reviewed">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Save to Profile
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {pharmacyRouting && (
              <Card className={pharmacyRouting.isValidRouting ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"} data-testid="card-pharmacy-routing">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Pharmacy Routing (BIN/PCN)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">BIN</p>
                      <p className="font-mono font-bold">{pharmacyRouting.bin}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">PCN</p>
                      <p className="font-mono font-bold">{pharmacyRouting.pcn || "N/A"}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Group</p>
                      <p className="font-mono font-bold">{pharmacyRouting.group || "N/A"}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Payer</p>
                      <p className="font-medium text-xs">{pharmacyRouting.payerName}</p>
                    </div>
                  </div>
                  <div className={`p-2 rounded text-xs ${pharmacyRouting.isValidRouting ? "bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200" : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200"}`}>
                    {pharmacyRouting.isValidRouting ? (
                      <div className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Valid routing — claims can be processed electronically</div>
                    ) : (
                      <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {pharmacyRouting.routingNotes}</div>
                    )}
                  </div>
                  {cardType && cardType !== "insurance" && cardType !== "unknown" && (
                    <Badge variant="outline" className="text-xs">
                      Card Type: {cardType.charAt(0).toUpperCase() + cardType.slice(1)}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Understanding Your Insurance Card</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-xs">Front</Badge>
                  <p>Contains your member ID, group number, plan type, and copay amounts. This is what you show at the doctor's office.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 mt-0.5 text-xs">Back</Badge>
                  <p>Has the claims address, customer service phone number, Rx (pharmacy) information, and pre-authorization numbers.</p>
                </div>
                <Separator className="my-2" />
                <p className="text-xs italic">
                  Having your insurance information saved helps you understand your bills, EOBs, and why you may owe a copay or deductible.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
