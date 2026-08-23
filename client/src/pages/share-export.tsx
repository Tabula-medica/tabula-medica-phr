import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  Share2,
  Download,
  Link2,
  Mail,
  QrCode,
  Clock,
  Shield,
  Copy,
  CheckCircle2,
  Loader2,
  FileDown,
  UserPlus,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Lock,
  Calendar,
} from "lucide-react";

interface ShareLink {
  id: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  recipientEmail?: string;
  accessCount: number;
  isActive: boolean;
}

const expirationOptions = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never expires" },
];

const exportFormats = [
  { value: "pdf", label: "PDF Document", description: "Best for printing and sharing" },
  { value: "ccd", label: "CCD (C-CDA)", description: "Clinical Document Architecture" },
  { value: "fhir", label: "FHIR Bundle", description: "HL7 FHIR R4 JSON format" },
  { value: "csv", label: "CSV Spreadsheet", description: "For data analysis" },
];

export default function ShareExport() {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiration, setExpiration] = useState("24h");
  const [requirePin, setRequirePin] = useState(true);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { data: shareLinks = [], isLoading: linksLoading } = useQuery<ShareLink[]>({
    queryKey: ["/api/share/links"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: { recipientEmail?: string; expiration: string; requirePin: boolean }) => {
      return apiRequest("POST", "/api/share/create-link", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share/links"] });
      toast({
        title: "Share link created",
        description: "Your secure share link is ready.",
      });
      setRecipientEmail("");
    },
    onError: () => {
      toast({
        title: "Failed to create link",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest("POST", `/api/share/revoke/${linkId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share/links"] });
      toast({
        title: "Link revoked",
        description: "The share link has been deactivated.",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      return apiRequest("POST", "/api/export/records", { format });
    },
    onSuccess: () => {
      toast({
        title: "Export started",
        description: "Your download will begin shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Export failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateLink = () => {
    createLinkMutation.mutate({
      recipientEmail: recipientEmail || undefined,
      expiration,
      requirePin,
    });
  };

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({
      title: "Link copied",
      description: "The share link has been copied to your clipboard.",
    });
  };

  const handleExport = () => {
    exportMutation.mutate(exportFormat);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" data-testid="page-share-export">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-title">
          Share & Export Records
        </h1>
        <p className="text-muted-foreground">
          Securely share your health records with providers or download for your own use.
        </p>
      </div>

      <Tabs defaultValue="share" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="share" className="gap-2" data-testid="tab-share">
            <Share2 className="h-4 w-4" />
            Share
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2" data-testid="tab-export">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="share" className="space-y-6">
          <Card data-testid="card-create-link">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Create Share Link
              </CardTitle>
              <CardDescription>
                Generate a secure, time-limited link to share your records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Recipient Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  If provided, an email notification will be sent
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Link Expiration</Label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger data-testid="select-expiration">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    {expirationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 flex-wrap">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="require-pin" className="cursor-pointer">
                      Require PIN to access
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Adds an extra layer of security
                    </p>
                  </div>
                </div>
                <Switch
                  id="require-pin"
                  checked={requirePin}
                  onCheckedChange={setRequirePin}
                  data-testid="switch-require-pin"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full gap-2"
                onClick={handleCreateLink}
                disabled={createLinkMutation.isPending}
                data-testid="button-create-link"
              >
                {createLinkMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Create Secure Link
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card data-testid="card-active-links">
            <CardHeader>
              <CardTitle>Active Share Links</CardTitle>
              <CardDescription>
                Manage your existing share links
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No active share links</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border flex-wrap"
                      data-testid={`link-${link.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={link.isActive ? "secondary" : "outline"}>
                            {link.isActive ? "Active" : "Expired"}
                          </Badge>
                          {link.recipientEmail && (
                            <span className="text-sm truncate">{link.recipientEmail}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created {formatDate(link.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {formatDate(link.expiresAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {link.accessCount} views
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyLink(link.url)}
                          data-testid={`button-copy-${link.id}`}
                        >
                          {copiedLink === link.url ? (
                            <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeLinkMutation.mutate(link.id)}
                          disabled={revokeLinkMutation.isPending}
                          data-testid={`button-revoke-${link.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card data-testid="card-export">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Export Your Records
              </CardTitle>
              <CardDescription>
                Download a copy of your health records in various formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <FieldCaption>Export Format</FieldCaption>
                <div className="grid sm:grid-cols-2 gap-3">
                  {exportFormats.map((format) => (
                    <div
                      key={format.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        exportFormat === format.value
                          ? "border-accent bg-accent/10"
                          : "border-border"
                      }`}
                      {...clickable(() => setExportFormat(format.value))}
                      data-testid={`format-${format.value}`}
                    >
                      <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0">
                        {exportFormat === format.value && (
                          <div className="h-2 w-2 rounded-full bg-accent-foreground" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{format.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Your export will include all available health records</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full gap-2"
                onClick={handleExport}
                disabled={exportMutation.isPending}
                data-testid="button-export"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing Export...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download {exportFormats.find((f) => f.value === exportFormat)?.label}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card data-testid="card-quick-share">
            <CardHeader>
              <CardTitle>Quick Share Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-3">
                <Button variant="outline" className="gap-2 h-auto py-4 flex-col" data-testid="button-email">
                  <Mail className="h-5 w-5" />
                  <span>Email</span>
                </Button>
                <Button variant="outline" className="gap-2 h-auto py-4 flex-col" data-testid="button-qr">
                  <QrCode className="h-5 w-5" />
                  <span>QR Code</span>
                </Button>
                <Button variant="outline" className="gap-2 h-auto py-4 flex-col" data-testid="button-provider">
                  <UserPlus className="h-5 w-5" />
                  <span>Add Provider</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
