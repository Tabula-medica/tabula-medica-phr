import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Share2, QrCode, Link2, FileText, Copy, Check, Download, Clock, Shield, Loader2, ExternalLink, Printer, Smartphone } from "lucide-react";

interface QuickShareData {
  qrCodeUrl?: string;
  secureLink?: string;
  accessCode?: string;
  expiresAt?: string;
  shareId?: string;
}

interface QuickShareModalProps {
  trigger?: React.ReactNode;
  patientId?: string;
  recordType?: "summary" | "medications" | "lab-results" | "vitals" | "full-record";
  onShareComplete?: (shareId: string) => void;
}

export function QuickShareModal({ trigger, patientId = "current", recordType = "summary", onShareComplete }: QuickShareModalProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("qr");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [shareData, setShareData] = useState<QuickShareData | null>(null);

  const generateShareMutation = useMutation({
    mutationFn: async (mode: "qr" | "link" | "pdf") => {
      const response = await apiRequest("POST", "/api/quick-share/generate", {
        patientId,
        recordType,
        mode,
        expiresIn: mode === "qr" ? "10m" : "72h",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setShareData(data);
      if (onShareComplete && data.shareId) {
        onShareComplete(data.shareId);
      }
    },
    onError: () => {
      toast({
        title: "Failed to generate share",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/quick-share/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, recordType }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-summary-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "Your health summary is ready to print.",
      });
    },
    onError: () => {
      toast({
        title: "Download failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (open && activeTab === "qr" && !shareData?.qrCodeUrl) {
      generateShareMutation.mutate("qr");
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (open && shareData?.qrCodeUrl && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [open, shareData?.qrCodeUrl, countdown]);

  useEffect(() => {
    if (!open) {
      setCountdown(10);
      setShareData(null);
      setCopied(false);
    }
  }, [open]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "link" && !shareData?.secureLink) {
      generateShareMutation.mutate("link");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Share this link with your doctor.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return "";
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours >= 24) {
      return `${Math.floor(diffHours / 24)} days`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins} minutes`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="default" data-testid="button-quick-share">
            <Share2 className="h-4 w-4 mr-2" />
            Share with Doctor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share with Doctor
          </DialogTitle>
          <DialogDescription>
            Share your health records instantly and securely
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="qr" className="flex items-center gap-1.5" data-testid="tab-qr">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR Code</span>
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-1.5" data-testid="tab-link">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Link</span>
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex items-center gap-1.5" data-testid="tab-pdf">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="mt-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                {generateShareMutation.isPending ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating QR code...</p>
                  </div>
                ) : shareData?.qrCodeUrl ? (
                  <>
                    <div className="relative">
                      <img 
                        src={shareData.qrCodeUrl} 
                        alt="Share QR Code" 
                        className="w-48 h-48 rounded-lg border-2 border-primary/20"
                        data-testid="img-qr-code"
                      />
                      <div className="absolute -bottom-2 -right-2">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {countdown > 0 ? `${countdown}m left` : "Expired"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 text-center space-y-2">
                      <p className="font-medium">Show this to your doctor</p>
                      <p className="text-sm text-muted-foreground">
                        They can scan it with their phone to view your records
                      </p>
                      {shareData.accessCode && (
                        <div className="flex items-center justify-center gap-2 mt-3">
                          <Badge variant="outline" className="text-lg font-mono px-3 py-1">
                            {shareData.accessCode}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Access Code</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>Secure, HIPAA-compliant sharing</span>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to generate QR code</p>
                    <Button 
                      onClick={() => generateShareMutation.mutate("qr")} 
                      className="mt-4"
                      data-testid="button-generate-qr"
                    >
                      Generate QR Code
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="link" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {generateShareMutation.isPending ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Generating secure link...</p>
                  </div>
                ) : shareData?.secureLink ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-md p-3 font-mono text-sm truncate">
                        {shareData.secureLink}
                      </div>
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => copyToClipboard(shareData.secureLink!)}
                        data-testid="button-copy-link"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Expires in {formatExpiry(shareData.expiresAt)}</span>
                      </div>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        72h expiry
                      </Badge>
                    </div>
                    {shareData.accessCode && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm">Access Code:</span>
                        <Badge variant="secondary" className="font-mono text-lg">
                          {shareData.accessCode}
                        </Badge>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => copyToClipboard(shareData.secureLink!)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: "My Health Records",
                              text: "View my health summary",
                              url: shareData.secureLink,
                            });
                          }
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Create a secure, time-limited link</p>
                    <Button 
                      onClick={() => generateShareMutation.mutate("link")} 
                      className="mt-4"
                      data-testid="button-generate-link"
                    >
                      Generate Secure Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium">PDF Health Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    Download a print-ready PDF of your health records
                  </p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Includes medications, conditions, and recent labs</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Print-friendly format for doctor visits</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Password-protected for security</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1"
                    onClick={() => downloadPdfMutation.mutate()}
                    disabled={downloadPdfMutation.isPending}
                    data-testid="button-download-pdf"
                  >
                    {downloadPdfMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download PDF
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.print()}
                    data-testid="button-print"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-2">
            <Smartphone className="h-4 w-4 mt-0.5 text-primary" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Pro tip for your visit</p>
              <p>Open this on your phone before your appointment. Your doctor can scan the QR code instantly.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickShareButton({ className, variant = "default", size = "default" }: { 
  className?: string; 
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <QuickShareModal
      trigger={
        <Button variant={variant} size={size} className={className} data-testid="button-quick-share-trigger">
          <Share2 className="h-4 w-4 mr-2" />
          Share with Doctor
        </Button>
      }
    />
  );
}
