import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageGate } from "@/components/page-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/components/shared/format-helpers";
import {
  Download,
  Share2,
  FileText,
  Pill,
  Heart,
  Syringe,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Copy,
  Mail,
  Link2,
  Clock,
  Shield,
  Building2,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface PatientSummaryData {
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  generatedDate: string;
  summary: {
    overallHealth: string;
    activeConditions: string[];
    currentMedications: { name: string; dose: string; frequency: string }[];
    allergies: string[];
    recentLabs: { name: string; value: string; date: string; status: string }[];
    recentVisits: { date: string; provider: string; reason: string; facility: string }[];
    immunizations: { name: string; date: string }[];
    upcomingAppointments: { date: string; provider: string; reason: string }[];
  };
  sources: { name: string; lastSynced: string }[];
  disclaimer: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Normal: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Improved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Borderline: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    High: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <Badge variant="outline" className={colors[status] || ""}>
      {status}
    </Badge>
  );
}

export default function ProviderShare() {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [shareResult, setShareResult] = useState<{
    shareUrl: string;
    expiresAt: string;
  } | null>(null);

  const summaryQuery = useQuery<{ success: boolean; data: PatientSummaryData }>({
    queryKey: ["/api/provider-packet/summary"],
  });

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const shareMutation = useMutation({
    mutationFn: async (data: { recipientEmail: string; recipientName: string }) => {
      const res = await apiRequest("POST", "/api/provider-packet/share", data);
      return res.json();
    },
    onSuccess: (data) => {
      setShareResult({
        shareUrl: data.data.shareUrl,
        expiresAt: data.data.expiresAt,
      });
      toast({
        title: "Share link created",
        description: "A secure link has been generated for your provider.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create share link",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    try {
      const response = await fetch("/api/provider-packet/download");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patient-summary-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Download started",
        description: "Your health summary PDF is downloading.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = () => {
    if (shareResult?.shareUrl) {
      navigator.clipboard.writeText(shareResult.shareUrl);
      toast({
        title: "Link copied",
        description: "The share link has been copied to your clipboard.",
      });
    }
  };

  const summary = summaryQuery.data?.data;

  if (summaryQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summary) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Summary</AlertTitle>
          <AlertDescription>
            Unable to load your health summary. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <PageGate feature="provider_sharing" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <Share2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Share with Provider</h1>
            <p className="text-muted-foreground">
              Download or share your health summary with your care team
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownload} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-open-share">
                <Mail className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share with Provider</DialogTitle>
                <DialogDescription>
                  Create a secure, time-limited link to share your health summary.
                </DialogDescription>
              </DialogHeader>

              {!shareResult ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipientName">Provider Name (optional)</Label>
                    <Input
                      id="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Dr. Smith"
                      data-testid="input-recipient-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipientEmail">Provider Email</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="provider@clinic.com"
                      data-testid="input-recipient-email"
                    />
                  </div>
                  <Alert className="bg-muted/50">
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      The link will expire in 7 days. Your provider can view but not download your complete records.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-200">
                      Link Created Successfully
                    </AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      Share this secure link with your provider.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2">
                    <Input
                      value={shareResult.shareUrl}
                      readOnly
                      className="flex-1 bg-muted"
                      data-testid="input-share-url"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="button-copy-link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Expires: {formatDate(shareResult.expiresAt)}</span>
                  </div>
                </div>
              )}

              <DialogFooter>
                {!shareResult ? (
                  <Button
                    onClick={() => shareMutation.mutate({ recipientEmail, recipientName })}
                    disabled={!isValidEmail(recipientEmail) || shareMutation.isPending}
                    data-testid="button-create-share"
                  >
                    {shareMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-2" />
                        Create Share Link
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setShareDialogOpen(false);
                      setShareResult(null);
                      setRecipientEmail("");
                      setRecipientName("");
                    }}
                    data-testid="button-done"
                  >
                    Done
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">
          HIPAA-Compliant Sharing
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          All shared data is encrypted and access is logged for your security.
          You can revoke access at any time.
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{summary.patientName}</CardTitle>
              <CardDescription className="mt-1">
                DOB: {formatDate(summary.dateOfBirth)} | MRN: {summary.mrn}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Updated {formatDate(summary.generatedDate)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>{summary.summary.overallHealth}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conditions" data-testid="tab-conditions">
            <Heart className="h-4 w-4 mr-2" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">
            <FileText className="h-4 w-4 mr-2" />
            Labs
          </TabsTrigger>
          <TabsTrigger value="visits" data-testid="tab-visits">
            <Building2 className="h-4 w-4 mr-2" />
            Visits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Active Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.summary.activeConditions.map((condition, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg border">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span>{condition}</span>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <h4 className="font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Allergies
              </h4>
              <div className="flex flex-wrap gap-2">
                {summary.summary.allergies.map((allergy, i) => (
                  <Badge key={i} variant="destructive">
                    {allergy}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Current Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.summary.currentMedications.map((med, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Pill className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">{med.dose}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{med.frequency}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Laboratory Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.summary.recentLabs.map((lab, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{lab.name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(lab.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{lab.value}</span>
                      <StatusBadge status={lab.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Recent Visits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.summary.recentVisits.map((visit, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{visit.reason}</p>
                        <p className="text-sm text-muted-foreground">{visit.provider}</p>
                      </div>
                      <Badge variant="outline">{formatDate(visit.date)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{visit.facility}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                Immunization History
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {summary.summary.immunizations.map((imm, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{imm.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(imm.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6 bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium mb-2">Data Sources</h4>
              <div className="flex flex-wrap gap-2">
                {summary.sources.map((source, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {source.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground pt-0">
          {summary.disclaimer}
        </CardFooter>
      </Card>
    </div>
  );
}
