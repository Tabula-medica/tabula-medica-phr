import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDate, formatDateTime } from "@/components/shared/format-helpers";
import {
  Share2,
  Link,
  Copy,
  Check,
  X,
  Clock,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  Users,
  Pill,
  TestTube,
  Activity,
  Heart,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Calendar,
  Lock,
  Unlock,
  ChevronRight,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface ShareableSection {
  id: string;
  name: string;
  description: string;
  fhirResourceTypes: string[];
}

interface HealthDataShare {
  id: string;
  patientId: string;
  token?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientType: 'provider' | 'family' | 'caregiver' | 'other';
  sections: string[];
  createdAt: string;
  expiresAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
  revokedReason?: string;
  maxAccesses?: number;
  requiresPin?: boolean;
  notes?: string;
}

interface ShareAccessLog {
  id: string;
  timestamp: string;
  accessorIp?: string;
  accessorAgent?: string;
  sectionsAccessed: string[];
  success: boolean;
  failureReason?: string;
}

interface HealthDataShareManagerProps {
  patientId: string;
}

function getSectionIcon(sectionId: string) {
  switch (sectionId) {
    case 'medications': return <Pill className="w-4 h-4" />;
    case 'labs': return <TestTube className="w-4 h-4" />;
    case 'conditions': return <Activity className="w-4 h-4" />;
    case 'allergies': return <AlertTriangle className="w-4 h-4" />;
    case 'vitals': return <Heart className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
}


function getTimeRemaining(expiresAt: string): string {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;
  
  if (diff <= 0) return "Expired";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
  return "Less than 1 hour";
}

export function HealthDataShareManager({ patientId }: HealthDataShareManagerProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<HealthDataShare | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<ShareableSection[]>({
    queryKey: ["/api/health-share/sections"],
  });

  const { data: shares = [], isLoading: sharesLoading, refetch: refetchShares } = useQuery<HealthDataShare[]>({
    queryKey: ["/api/health-share/patient", patientId],
    queryFn: () => fetch(`/api/health-share/patient/${patientId}`).then(r => r.json()),
  });

  const createShareMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/health-share/create", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-share/patient", patientId] });
      setNewShareUrl(window.location.origin + result.shareUrl);
      toast({ title: "Share Created", description: "Your secure share link is ready" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create share", variant: "destructive" });
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: async ({ shareId, reason }: { shareId: string; reason?: string }) => {
      const response = await apiRequest("POST", `/api/health-share/revoke/${shareId}`, { patientId, reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-share/patient", patientId] });
      setSelectedShare(null);
      toast({ title: "Share Revoked", description: "Access has been revoked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to revoke share", variant: "destructive" });
    },
  });

  const copyShareUrl = async (token: string) => {
    const url = `${window.location.origin}/shared-health-data/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({ title: "Copied", description: "Share link copied to clipboard" });
  };

  const activeShares = shares.filter(s => s.status === 'active');
  const pastShares = shares.filter(s => s.status !== 'active');

  if (sharesLoading || sectionsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="health-data-share-manager">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                Health Data Sharing
              </CardTitle>
              <CardDescription>
                Securely share your health records with providers and family members
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-share">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Share
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <CreateShareForm 
                  patientId={patientId}
                  sections={sections}
                  onSubmit={(data) => {
                    createShareMutation.mutate(data);
                  }}
                  isLoading={createShareMutation.isPending}
                  onClose={() => setCreateDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {newShareUrl && (
            <Alert className="mb-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700 dark:text-green-300">Share Link Created</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-sm text-green-600 dark:text-green-400">Copy this link and share it securely:</p>
                <div className="flex items-center gap-2">
                  <Input value={newShareUrl} readOnly className="text-xs" data-testid="input-share-url" />
                  <Button size="sm" onClick={() => { navigator.clipboard.writeText(newShareUrl); toast({ title: "Copied" }); }} data-testid="button-copy-new-url">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => setNewShareUrl(null)}>Dismiss</Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" data-testid="tab-active-shares">
                Active Shares
                {activeShares.length > 0 && <Badge variant="secondary" className="ml-1">{activeShares.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-share-history">
                History
                {pastShares.length > 0 && <Badge variant="secondary" className="ml-1">{pastShares.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeShares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active shares</p>
                  <p className="text-sm">Create a share to give someone temporary access to your health data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeShares.map((share) => (
                    <ShareCard 
                      key={share.id} 
                      share={share} 
                      onCopyUrl={copyShareUrl}
                      onRevoke={() => setSelectedShare(share)}
                      onViewDetails={() => setSelectedShare(share)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {pastShares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No past shares</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastShares.map((share) => (
                    <ShareCard 
                      key={share.id} 
                      share={share}
                      onViewDetails={() => setSelectedShare(share)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedShare} onOpenChange={(open) => !open && setSelectedShare(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedShare && (
            <ShareDetailsDialog 
              share={selectedShare}
              patientId={patientId}
              onRevoke={(reason) => revokeShareMutation.mutate({ shareId: selectedShare.id, reason })}
              isRevoking={revokeShareMutation.isPending}
              onCopyUrl={copyShareUrl}
            />
          )}
        </DialogContent>
      </Dialog>

      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700 dark:text-blue-300">Your Data, Your Control</AlertTitle>
        <AlertDescription className="text-xs text-blue-600 dark:text-blue-400">
          All shares are encrypted and time-limited. You can revoke access at any time. 
          All access is logged for your security.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ShareCard({ 
  share, 
  onCopyUrl, 
  onRevoke, 
  onViewDetails 
}: { 
  share: HealthDataShare; 
  onCopyUrl?: (token: string) => void;
  onRevoke?: () => void;
  onViewDetails?: () => void;
}) {
  const isActive = share.status === 'active';

  return (
    <Card className="hover-elevate" data-testid={`share-card-${share.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              share.recipientType === 'provider' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
              share.recipientType === 'family' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
              share.recipientType === 'caregiver' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
              'bg-muted text-muted-foreground'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium">{share.recipientName}</p>
              <p className="text-xs text-muted-foreground capitalize">{share.recipientType}</p>
              <div className="flex flex-wrap items-center gap-1 mt-2">
                {share.sections.slice(0, 3).map(sectionId => (
                  <Badge key={sectionId} variant="outline" className="text-xs">
                    {sectionId}
                  </Badge>
                ))}
                {share.sections.length > 3 && (
                  <Badge variant="outline" className="text-xs">+{share.sections.length - 3} more</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <Badge 
              variant={isActive ? "default" : share.status === 'revoked' ? "destructive" : "secondary"}
              className="text-xs"
            >
              {share.status}
            </Badge>
            {isActive && (
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {getTimeRemaining(share.expiresAt)}
              </span>
            )}
            {share.accessCount > 0 && (
              <span className="text-xs text-muted-foreground">
                <Eye className="w-3 h-3 inline mr-1" />
                {share.accessCount} access{share.accessCount > 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          {isActive && share.token && onCopyUrl && (
            <Button variant="outline" size="sm" onClick={() => onCopyUrl(share.token!)} data-testid={`button-copy-${share.id}`}>
              <Copy className="w-3 h-3 mr-1" />
              Copy Link
            </Button>
          )}
          {onViewDetails && (
            <Button variant="ghost" size="sm" onClick={onViewDetails} data-testid={`button-details-${share.id}`}>
              View Details
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
          {isActive && onRevoke && (
            <Button variant="ghost" size="sm" className="text-red-500 ml-auto" onClick={onRevoke} data-testid={`button-revoke-${share.id}`}>
              <X className="w-3 h-3 mr-1" />
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateShareForm({ 
  patientId, 
  sections, 
  onSubmit, 
  isLoading,
  onClose 
}: { 
  patientId: string;
  sections: ShareableSection[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onClose: () => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientType, setRecipientType] = useState<string>("provider");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [maxAccesses, setMaxAccesses] = useState<string>("");
  const [requiresPin, setRequiresPin] = useState(false);
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState("");

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      patientId,
      recipientName,
      recipientEmail: recipientEmail || undefined,
      recipientType,
      sections: selectedSections,
      expiresInHours: parseInt(expiresInHours),
      maxAccesses: maxAccesses ? parseInt(maxAccesses) : undefined,
      requiresPin,
      pin: requiresPin ? pin : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Create New Share
        </DialogTitle>
        <DialogDescription>
          Share your health data securely with a provider or family member
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="recipientName">Recipient Name *</Label>
          <Input
            id="recipientName"
            placeholder="e.g., Dr. Sarah Johnson"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            data-testid="input-recipient-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipientEmail">Recipient Email (optional)</Label>
          <Input
            id="recipientEmail"
            type="email"
            placeholder="email@example.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            data-testid="input-recipient-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="health-data-share-recipient-type">Recipient Type *</Label>
          <Select value={recipientType} onValueChange={setRecipientType}>
            <SelectTrigger id="health-data-share-recipient-type" data-testid="select-recipient-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">Healthcare Provider</SelectItem>
              <SelectItem value="family">Family Member</SelectItem>
              <SelectItem value="caregiver">Caregiver</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="health-data-share-data-sections-to-share">Data Sections to Share *</Label>
          <p className="text-xs text-muted-foreground">Select which parts of your health record to share</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {sections.map(section => (
              <div role="presentation"
                key={section.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedSections.includes(section.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleSection(section.id)}
                data-testid={`section-${section.id}`}
              >
                <div className="flex items-center gap-2">
                  <Checkbox id="health-data-share-data-sections-to-share" 
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  {getSectionIcon(section.id)}
                  <span className="text-sm font-medium">{section.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">{section.description}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="health-data-share-expires-after">Expires After *</Label>
            <Select value={expiresInHours} onValueChange={setExpiresInHours}>
              <SelectTrigger id="health-data-share-expires-after" data-testid="select-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">1 week</SelectItem>
                <SelectItem value="336">2 weeks</SelectItem>
                <SelectItem value="720">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="health-data-share-max-accesses-optional">Max Accesses (optional)</Label>
            <Input id="health-data-share-max-accesses-optional"
              type="number"
              placeholder="Unlimited"
              min={1}
              max={100}
              value={maxAccesses}
              onChange={(e) => setMaxAccesses(e.target.value)}
              data-testid="input-max-accesses"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 border rounded-lg">
          <Checkbox 
            id="requiresPin"
            checked={requiresPin}
            onCheckedChange={(checked) => setRequiresPin(!!checked)}
            data-testid="checkbox-requires-pin"
          />
          <Label htmlFor="requiresPin" className="flex items-center gap-2 cursor-pointer">
            <Lock className="w-4 h-4" />
            Require PIN to access
          </Label>
        </div>

        {requiresPin && (
          <div className="space-y-2">
            <Label htmlFor="pin">PIN Code (4-6 digits)</Label>
            <Input
              id="pin"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              pattern="[0-9]{4,6}"
              required={requiresPin}
              data-testid="input-pin"
            />
            <p className="text-xs text-muted-foreground">Share this PIN separately with the recipient</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g., For my upcoming appointment on Jan 30"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            data-testid="input-notes"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-create">
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || !recipientName || selectedSections.length === 0 || (requiresPin && pin.length < 4)}
          data-testid="button-submit-create"
        >
          {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
          Create Share
        </Button>
      </DialogFooter>
    </form>
  );
}

function ShareDetailsDialog({
  share,
  patientId,
  onRevoke,
  isRevoking,
  onCopyUrl,
}: {
  share: HealthDataShare;
  patientId: string;
  onRevoke: (reason?: string) => void;
  isRevoking: boolean;
  onCopyUrl?: (token: string) => void;
}) {
  const [revokeReason, setRevokeReason] = useState("");
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const { data: accessLog = [] } = useQuery<ShareAccessLog[]>({
    queryKey: ["/api/health-share/access-log", share.id, patientId],
    queryFn: () => fetch(`/api/health-share/access-log/${share.id}?patientId=${patientId}`).then(r => r.json()),
  });

  const isActive = share.status === 'active';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Share Details
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{share.recipientName}</p>
            <p className="text-sm text-muted-foreground capitalize">{share.recipientType}</p>
            {share.recipientEmail && (
              <p className="text-sm text-muted-foreground">{share.recipientEmail}</p>
            )}
          </div>
          <Badge 
            variant={isActive ? "default" : share.status === 'revoked' ? "destructive" : "secondary"}
          >
            {share.status}
          </Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Created</p>
            <p>{formatDateTime(share.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{isActive ? "Expires" : "Expired"}</p>
            <p>{formatDateTime(share.expiresAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Times Accessed</p>
            <p>{share.accessCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Accessed</p>
            <p>{share.lastAccessedAt ? formatDateTime(share.lastAccessedAt) : "Never"}</p>
          </div>
        </div>

        {share.notes && (
          <div>
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="text-sm">{share.notes}</p>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground mb-2">Shared Sections</p>
          <div className="flex flex-wrap gap-1">
            {share.sections.map(sectionId => (
              <Badge key={sectionId} variant="outline">
                {getSectionIcon(sectionId)}
                <span className="ml-1">{sectionId}</span>
              </Badge>
            ))}
          </div>
        </div>

        {share.requiresPin && (
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4" />
            <span>PIN protection enabled</span>
          </div>
        )}

        {share.status === 'revoked' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Revoked</AlertTitle>
            <AlertDescription>
              {share.revokedAt && <p>Revoked on {formatDateTime(share.revokedAt)}</p>}
              {share.revokedReason && <p>Reason: {share.revokedReason}</p>}
            </AlertDescription>
          </Alert>
        )}

        {accessLog.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Access History</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {accessLog.map(log => (
                <div key={log.id} className="text-xs p-2 bg-muted rounded flex items-center justify-between">
                  <span>{formatDateTime(log.timestamp)}</span>
                  <Badge variant={log.success ? "outline" : "destructive"} className="text-xs">
                    {log.success ? "Success" : log.failureReason || "Failed"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        {isActive && share.token && onCopyUrl && (
          <Button variant="outline" onClick={() => onCopyUrl(share.token!)} className="w-full sm:w-auto" data-testid="button-copy-details">
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        )}
        {isActive && !showRevokeConfirm && (
          <Button variant="destructive" onClick={() => setShowRevokeConfirm(true)} className="w-full sm:w-auto" data-testid="button-revoke-details">
            <X className="w-4 h-4 mr-2" />
            Revoke Access
          </Button>
        )}
        {showRevokeConfirm && (
          <div className="w-full space-y-2">
            <Input
              placeholder="Reason for revoking (optional)"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              data-testid="input-revoke-reason"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRevokeConfirm(false)} className="flex-1" data-testid="button-cancel-revoke">
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => onRevoke(revokeReason)} disabled={isRevoking} className="flex-1" data-testid="button-confirm-revoke">
                {isRevoking ? "Revoking..." : "Confirm Revoke"}
              </Button>
            </div>
          </div>
        )}
      </DialogFooter>
    </>
  );
}
