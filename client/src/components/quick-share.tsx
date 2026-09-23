import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Share2,
  QrCode,
  Clock,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Link2,
} from "lucide-react";

interface ShareLink {
  id: string;
  url: string;
  pin?: string;
  expiresAt: string;
  viewCount: number;
  maxViews?: number;
  isRevoked: boolean;
  createdAt: string;
  accessLog: { timestamp: string; ipHash: string }[];
}

interface QuickShareProps {
  patientId?: string;
  resourceType?: "summary" | "timeline" | "medications" | "labs" | "immunizations" | "custom";
  resourceIds?: string[];
  trigger?: React.ReactNode;
}

export function QuickShare({ 
  patientId, 
  resourceType = "summary",
  resourceIds,
  trigger 
}: QuickShareProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Share settings
  const [usePin, setUsePin] = useState(false);
  const [expiryHours, setExpiryHours] = useState("24");
  const [maxViews, setMaxViews] = useState("");

  const createShareMutation = useMutation({
    mutationFn: async (): Promise<ShareLink> => {
      const res = await apiRequest("POST", "/api/share/create", {
        patientId,
        resourceType,
        resourceIds,
        settings: {
          usePin,
          expiryHours: parseInt(expiryHours),
          maxViews: maxViews ? parseInt(maxViews) : undefined,
        },
      });
      return res.json();
    },
    onSuccess: (data: ShareLink) => {
      setCreatedLink(data);
      toast({
        title: "Share Link Created",
        description: "Your secure share link is ready.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const res = await apiRequest("POST", `/api/share/${shareId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      setCreatedLink(null);
      setOpen(false);
      toast({
        title: "Link Revoked",
        description: "The share link has been permanently deactivated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke share link.",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    createShareMutation.mutate();
  };

  const handleRevoke = () => {
    if (createdLink) {
      revokeShareMutation.mutate(createdLink.id);
    }
  };

  const handleReset = () => {
    setCreatedLink(null);
    setUsePin(false);
    setExpiryHours("24");
    setMaxViews("");
  };

  const resourceTypeLabels: Record<string, string> = {
    summary: "Health Summary",
    timeline: "Health Timeline",
    medications: "Medications List",
    labs: "Lab Results",
    immunizations: "Immunization Records",
    custom: "Selected Records",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-1.5" data-testid="button-quick-share">
            <Share2 className="h-4 w-4" />
            Quick Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Quick Share
          </DialogTitle>
          <DialogDescription>
            Create a secure, time-limited link to share your {resourceTypeLabels[resourceType].toLowerCase()} 
            with providers or caregivers.
          </DialogDescription>
        </DialogHeader>

        {!createdLink ? (
          <div className="space-y-6 py-4">
            {/* What's being shared */}
            <div className="space-y-2">
              <FieldCaption>Sharing</FieldCaption>
              <Card>
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="font-medium">{resourceTypeLabels[resourceType]}</span>
                  <Badge variant="secondary">
                    {resourceIds?.length || "All"} records
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label htmlFor="expiry">Link Expires In</Label>
              <Select value={expiryHours} onValueChange={setExpiryHours}>
                <SelectTrigger id="expiry" data-testid="select-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PIN Protection */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use-pin">PIN Protection</Label>
                <p className="text-xs text-muted-foreground">
                  Require a 4-digit PIN to view (shown to you only)
                </p>
              </div>
              <Switch
                id="use-pin"
                checked={usePin}
                onCheckedChange={setUsePin}
                data-testid="switch-pin"
              />
            </div>

            {/* Max Views */}
            <div className="space-y-2">
              <Label htmlFor="max-views">Maximum Views (optional)</Label>
              <Input
                id="max-views"
                type="number"
                placeholder="Unlimited"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                min="1"
                max="100"
                data-testid="input-max-views"
              />
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>HIPAA Secure</AlertTitle>
              <AlertDescription className="text-xs">
                Links are encrypted and all access is logged. You can revoke access at any time.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* QR Code Placeholder */}
            <div className="flex justify-center">
              <div className="h-48 w-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <div className="text-center">
                  <QrCode className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-2">QR Code</p>
                </div>
              </div>
            </div>

            {/* Link */}
            <div className="space-y-2">
              <Label htmlFor="quick-share-share-link">Share Link</Label>
              <div className="flex gap-2">
                <Input id="quick-share-share-link"
                  value={createdLink.url}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-share-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(createdLink.url)}
                  data-testid="button-copy-url"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* PIN Display */}
            {createdLink.pin && (
              <div className="space-y-2">
                <Label htmlFor="quick-share-pin-code-show-to-recipient">PIN Code (show to recipient)</Label>
                <div className="flex gap-2">
                  <Input id="quick-share-pin-code-show-to-recipient"
                    value={createdLink.pin}
                    readOnly
                    className="font-mono text-2xl text-center tracking-[0.5em]"
                    data-testid="input-pin"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(createdLink.pin!)}
                    data-testid="button-copy-pin"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Expiry Info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Expires: {new Date(createdLink.expiresAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" />
                Views: {createdLink.viewCount}/{createdLink.maxViews || "∞"}
              </div>
            </div>

            <Separator />

            {/* Revoke Button */}
            <Alert variant="destructive" className="cursor-pointer" onClick={handleRevoke}>
              <Trash2 className="h-4 w-4" />
              <AlertTitle>Revoke Access</AlertTitle>
              <AlertDescription className="text-xs">
                Click here to immediately deactivate this share link.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {!createdLink ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={createShareMutation.isPending}
                className="gap-1.5"
                data-testid="button-create-share"
              >
                {createShareMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Create Share Link
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Create New
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActiveSharesManager({ patientId }: { patientId?: string }) {
  const { toast } = useToast();
  
  // This would fetch active shares from API
  const activeShares: ShareLink[] = [];

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const res = await apiRequest("POST", `/api/share/${shareId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Link Revoked",
        description: "The share link has been permanently deactivated.",
      });
    },
  });

  if (activeShares.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold">No Active Shares</h3>
          <p className="text-sm text-muted-foreground">
            You haven't shared any health records yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Share2 className="h-4 w-4" />
        Active Share Links
      </h3>
      
      {activeShares.map((share) => (
        <Card key={share.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={share.isRevoked ? "destructive" : "default"}>
                    {share.isRevoked ? "Revoked" : "Active"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {new Date(share.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expires: {new Date(share.expiresAt).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {share.viewCount} views
                  </span>
                </div>
              </div>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revokeMutation.mutate(share.id)}
                disabled={share.isRevoked || revokeMutation.isPending}
                className="gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
