import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Heart, 
  Stethoscope, 
  ChevronRight,
  ChevronLeft,
  Link as LinkIcon,
  FileDown,
  Copy,
  Check,
  Shield,
  Clock
} from "lucide-react";

type PacketType = "emergency" | "doctor" | null;
type Step = "choose" | "preview" | "share";

interface ShareResult {
  shareUrl: string;
  expiresAt: string;
  pin?: string;
}

export default function SimplifiedShare() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("choose");
  const [packetType, setPacketType] = useState<PacketType>(null);
  const [usePinProtection, setUsePinProtection] = useState(true);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  const createShareMutation = useMutation({
    mutationFn: async (data: { packetType: PacketType; usePinProtection: boolean }) => {
      const response = await apiRequest("POST", "/api/share/create-packet", {
        type: data.packetType,
        expiryDays: 7,
        pinProtected: data.usePinProtection,
      });
      return response.json();
    },
    onSuccess: (data: ShareResult) => {
      setShareResult(data);
      setStep("share");
      toast({
        title: "Packet Created",
        description: "Your share link is ready.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not create share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (type: PacketType) => {
      const response = await apiRequest("POST", "/api/share/download-pdf", {
        type,
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-packet.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "Your packet has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not download PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = async () => {
    if (shareResult?.shareUrl) {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard.",
      });
    }
  };

  const handleCreateShare = () => {
    createShareMutation.mutate({
      packetType,
      usePinProtection,
    });
  };

  const handleStartOver = () => {
    setStep("choose");
    setPacketType(null);
    setShareResult(null);
    setUsePinProtection(true);
    setCopied(false);
  };

  return (
    <div className="simplified-container p-6 md:p-7 space-y-6 pb-32">
      <header>
        <h1 
          className="text-3xl md:text-4xl font-bold tracking-tight"
          data-testid="text-simplified-share-title"
        >
          Share My Records
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          {step === "choose" && "Choose what to share"}
          {step === "preview" && "Review before sharing"}
          {step === "share" && "Your share link is ready"}
        </p>
      </header>

      {step === "choose" && (
        <section className="space-y-4" aria-labelledby="packet-choice">
          <h2 id="packet-choice" className="sr-only">Choose Packet Type</h2>

          <Card 
            className={`cursor-pointer transition-all border-2 ${
              packetType === "emergency" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setPacketType("emergency")}
            data-testid="card-emergency-packet"
          >
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="h-7 w-7 text-destructive" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold">Emergency Packet</p>
                  <p className="text-muted-foreground">
                    Essential info for emergency responders: allergies, medications, conditions, and emergency contacts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all border-2 ${
              packetType === "doctor" ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setPacketType("doctor")}
            data-testid="card-doctor-packet"
          >
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="h-7 w-7 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold">Doctor Packet</p>
                  <p className="text-muted-foreground">
                    Complete medical history for healthcare providers: visit notes, lab results, imaging, and more.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full h-[60px] text-lg font-semibold mt-6"
            disabled={!packetType}
            onClick={() => setStep("preview")}
            data-testid="button-continue-to-preview"
          >
            Continue
            <ChevronRight className="h-5 w-5 ml-2" aria-hidden="true" />
          </Button>
        </section>
      )}

      {step === "preview" && (
        <section className="space-y-6" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="sr-only">Preview Settings</h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                {packetType === "emergency" ? (
                  <Heart className="h-5 w-5 text-destructive" />
                ) : (
                  <Stethoscope className="h-5 w-5 text-primary" />
                )}
                {packetType === "emergency" ? "Emergency Packet" : "Doctor Packet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-lg font-medium">What&apos;s included:</p>
                {packetType === "emergency" ? (
                  <ul className="text-muted-foreground space-y-1 text-lg">
                    <li>• Allergies and reactions</li>
                    <li>• Current medications</li>
                    <li>• Medical conditions</li>
                    <li>• Emergency contacts</li>
                  </ul>
                ) : (
                  <ul className="text-muted-foreground space-y-1 text-lg">
                    <li>• Complete medical history</li>
                    <li>• Lab results and imaging</li>
                    <li>• Visit notes and summaries</li>
                    <li>• Medications and allergies</li>
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-lg font-medium">Link expires in 7 days</p>
                    <p className="text-muted-foreground">For your security</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <Label htmlFor="pin-toggle" className="text-lg font-medium cursor-pointer">
                      Require PIN to view
                    </Label>
                    <p className="text-muted-foreground">Extra protection</p>
                  </div>
                </div>
                <Switch
                  id="pin-toggle"
                  checked={usePinProtection}
                  onCheckedChange={setUsePinProtection}
                  data-testid="switch-pin-protection"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-[60px] text-lg"
              onClick={() => setStep("choose")}
              data-testid="button-back-to-choose"
            >
              <ChevronLeft className="h-5 w-5 mr-2" aria-hidden="true" />
              Back
            </Button>
            <Button
              className="flex-1 h-[60px] text-lg font-semibold"
              onClick={handleCreateShare}
              disabled={createShareMutation.isPending}
              data-testid="button-create-share-link"
            >
              {createShareMutation.isPending ? "Creating..." : "Create Share Link"}
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full h-[60px] text-lg"
            onClick={() => downloadPdfMutation.mutate(packetType)}
            disabled={downloadPdfMutation.isPending}
            data-testid="button-download-pdf"
          >
            <FileDown className="h-5 w-5 mr-2" aria-hidden="true" />
            {downloadPdfMutation.isPending ? "Downloading..." : "Download as PDF Instead"}
          </Button>
        </section>
      )}

      {step === "share" && shareResult && (
        <section className="space-y-6" aria-labelledby="share-result-heading">
          <h2 id="share-result-heading" className="sr-only">Share Link Ready</h2>

          <Card className="border-2 border-primary">
            <CardContent className="py-8 text-center space-y-6">
              <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-semibold">Your link is ready!</p>
                <p className="text-muted-foreground mt-2">
                  Expires on {new Date(shareResult.expiresAt).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <Input
                  readOnly
                  value={shareResult.shareUrl}
                  className="text-center text-lg bg-transparent border-0 focus-visible:ring-0"
                  data-testid="input-share-url"
                />
              </div>

              <Button
                className="w-full h-[60px] text-lg font-semibold"
                onClick={handleCopyLink}
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="h-5 w-5 mr-2" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5 mr-2" aria-hidden="true" />
                    Copy Link
                  </>
                )}
              </Button>

              {shareResult.pin && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-muted-foreground mb-1">PIN to share:</p>
                  <p className="text-3xl font-mono font-bold tracking-widest">{shareResult.pin}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full h-[60px] text-lg"
            onClick={handleStartOver}
            data-testid="button-share-another"
          >
            Share Something Else
          </Button>
        </section>
      )}
    </div>
  );
}
