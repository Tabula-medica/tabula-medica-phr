import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Share2,
  QrCode,
  Link2,
  Clock,
  Eye,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertCircle,
  RefreshCw,
  Plus,
  FileText,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AccessLog {
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

interface ShareLink {
  shareId: string;
  recordType: string;
  expiresAt: string;
  accessCount: number;
  createdAt: string;
  revoked: boolean;
  secureLink: string;
  accessLogs: AccessLog[];
}

interface NewShareData {
  shareId: string;
  secureLink: string;
  accessCode: string;
  expiresAt: string;
  qrCodeUrl?: string;
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  summary: "Health Summary",
  medications: "Medications Only",
  "lab-results": "Lab Results Only",
  vitals: "Vitals Only",
  "full-record": "Full Record",
};

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();
  
  if (diff <= 0) return "Expired";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

function getDeviceIcon(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
}

function ShareLinkCard({ share, onRevoke }: { share: ShareLink; onRevoke: (shareId: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeRemaining = formatTimeRemaining(share.expiresAt);
  const isExpired = timeRemaining === "Expired";

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(share.secureLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={isExpired ? "opacity-60" : ""} data-testid={`card-share-${share.shareId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold" data-testid="text-record-type">
                {RECORD_TYPE_LABELS[share.recordType] || share.recordType}
              </span>
              <Badge 
                variant="outline" 
                className={isExpired 
                  ? "bg-gray-500/10 text-gray-600 border-gray-500/20" 
                  : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                }
                data-testid="badge-status"
              >
                {isExpired ? "Expired" : "Active"}
              </Badge>
              {share.accessCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1" data-testid="badge-access-count">
                      <Eye className="h-3 w-3" />
                      {share.accessCount} view{share.accessCount !== 1 ? "s" : ""}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This link has been accessed {share.accessCount} time{share.accessCount !== 1 ? "s" : ""}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            <div className="grid gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span data-testid="text-time-remaining">{timeRemaining}</span>
              </div>
              <div className="text-xs">
                Created: {new Date(share.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={copyShareLink}
              disabled={isExpired}
              data-testid="button-copy-link"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button 
              variant="destructive" 
              size="icon" 
              onClick={() => onRevoke(share.shareId)}
              disabled={isExpired}
              data-testid="button-revoke"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {share.accessLogs.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-3 gap-2"
                data-testid="button-toggle-access-log"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Access Log
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View Access Log ({share.accessLogs.length})
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="bg-muted/50 rounded-md p-3 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Who Accessed This Link
                </h4>
                {share.accessLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 text-sm py-2 border-b border-border/50 last:border-0"
                    data-testid={`access-log-entry-${idx}`}
                  >
                    {getDeviceIcon(log.userAgent)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {log.userAgent}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {log.ipAddress}
                    </Badge>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShareLinks() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRecordType, setSelectedRecordType] = useState("summary");
  const [selectedExpiry, setSelectedExpiry] = useState("72h");
  const [newShareData, setNewShareData] = useState<NewShareData | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: shares, isLoading, error, refetch } = useQuery<ShareLink[]>({
    queryKey: ["/api/quick-share/active"],
  });

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quick-share/generate", {
        recordType: selectedRecordType,
        mode: "qr",
        expiresIn: selectedExpiry,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setNewShareData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/quick-share/active"] });
      toast({
        title: "Share Link Created",
        description: "Your secure share link is ready.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Create Link",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      return apiRequest("DELETE", `/api/quick-share/${shareId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-share/active"] });
      toast({
        title: "Link Revoked",
        description: "The share link has been revoked and can no longer be accessed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Revoke",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNew = () => {
    setNewShareData(null);
    createShareMutation.mutate();
  };

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Share Links</h2>
            <p className="text-muted-foreground mb-4">
              There was a problem loading your share links. Please try again.
            </p>
            <Button onClick={() => refetch()} data-testid="button-retry">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-2" data-testid="heading-page-title">Share Links</h1>
            <p className="text-muted-foreground">
              Create secure links to share your health records with clinicians. 
              Links expire automatically and you can revoke access anytime.
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-share">
                <Plus className="h-4 w-4 mr-2" />
                Create Share Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Create Secure Share Link
                </DialogTitle>
                <DialogDescription>
                  Generate a secure link to share your health records with a clinician.
                </DialogDescription>
              </DialogHeader>
              
              {!newShareData ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="share-links-what-to-share" className="text-sm font-medium">What to Share</label>
                    <Select value={selectedRecordType} onValueChange={setSelectedRecordType}>
                      <SelectTrigger id="share-links-what-to-share" data-testid="select-record-type">
                        <SelectValue placeholder="Select record type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Health Summary</SelectItem>
                        <SelectItem value="medications">Medications Only</SelectItem>
                        <SelectItem value="lab-results">Lab Results Only</SelectItem>
                        <SelectItem value="vitals">Vitals Only</SelectItem>
                        <SelectItem value="full-record">Full Record</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="share-links-link-expires-in" className="text-sm font-medium">Link Expires In</label>
                    <Select value={selectedExpiry} onValueChange={setSelectedExpiry}>
                      <SelectTrigger id="share-links-link-expires-in" data-testid="select-expiry">
                        <SelectValue placeholder="Select expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">24 hours</SelectItem>
                        <SelectItem value="48h">48 hours</SelectItem>
                        <SelectItem value="72h">72 hours (recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-md">
                    <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Links are secured with access codes and automatically expire. 
                      You can revoke access at any time.
                    </p>
                  </div>

                  <Button 
                    onClick={handleCreateNew} 
                    className="w-full"
                    disabled={createShareMutation.isPending}
                    data-testid="button-generate-link"
                  >
                    {createShareMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Generate Link & QR Code
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="flex justify-center">
                    {newShareData.qrCodeUrl && (
                      <img 
                        src={newShareData.qrCodeUrl} 
                        alt="QR Code" 
                        className="w-48 h-48 rounded-lg border"
                        data-testid="img-qr-code"
                      />
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Scan with phone or share the link below
                    </p>
                    <div className="flex items-center gap-2 bg-muted p-2 rounded-md">
                      <input 
                        type="text" 
                        readOnly 
                        value={newShareData.secureLink}
                        className="flex-1 bg-transparent text-xs outline-none"
                        data-testid="input-share-link"
                      />
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(newShareData.secureLink)}
                        data-testid="button-copy-new-link"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires: {new Date(newShareData.expiresAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setCreateDialogOpen(false)}
                      data-testid="button-done"
                    >
                      Done
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => setNewShareData(null)}
                      data-testid="button-create-another"
                    >
                      Create Another
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : shares && shares.length > 0 ? (
        <div className="space-y-4">
          {shares.map((share) => (
            <ShareLinkCard 
              key={share.shareId} 
              share={share} 
              onRevoke={(shareId) => revokeMutation.mutate(shareId)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Active Share Links</h2>
            <p className="text-muted-foreground mb-4">
              Create a secure link to share your health records with clinicians.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Share Link
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Security Information</p>
              <ul className="list-disc list-inside space-y-1">
                <li>All share links are encrypted and require an access code</li>
                <li>Links automatically expire after the selected time period</li>
                <li>You can revoke any link at any time to immediately stop access</li>
                <li>Access logs show when and from where your records were viewed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-share-disclaimer" />
    </div>
  );
}
