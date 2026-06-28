import { useState, useEffect } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useSEO, buildPageSchemas, buildHowToSchema } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import { 
  Plus,
  Link2,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Loader2,
  ExternalLink,
  Shield,
  AlertTriangle,
  Database,
  Watch,
  Smartphone,
  Activity,
  Heart,
  Moon,
  Zap,
  ArrowRight,
  Network,
  Search,
  Building2,
  MapPin
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { InlineFhirLimitBanner, UpgradeDialog, SoftUpgradePrompt } from "@/components/soft-upgrade-prompt";
import type { EhrConnection, EhrPlatform, WearableConnection, WearablePlatform, WearableDataType } from "@shared/schema";
import { ehrPlatforms, ehrPlatformInfo, wearablePlatforms, wearablePlatformInfo, wearableDataTypes } from "@shared/schema";

// Status configuration for connection states using Badge variants
const statusConfig: Record<string, { 
  label: string; 
  icon: typeof CheckCircle; 
  variant: "default" | "secondary" | "destructive" | "outline";
}> = {
  connected: { 
    label: "Connected", 
    icon: CheckCircle, 
    variant: "default"
  },
  expired: { 
    label: "Expired", 
    icon: AlertTriangle, 
    variant: "secondary"
  },
  syncing: { 
    label: "Syncing", 
    icon: RefreshCw, 
    variant: "secondary"
  },
  error: { 
    label: "Error", 
    icon: AlertCircle, 
    variant: "destructive"
  },
  pending_auth: { 
    label: "Pending", 
    icon: Shield, 
    variant: "outline"
  },
  disconnected: { 
    label: "Disconnected", 
    icon: AlertCircle, 
    variant: "outline"
  },
};

// Status pill component using Badge for semantic styling
function StatusPill({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.disconnected;
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant}
      data-testid={`status-pill-${status}`}
    >
      <Icon className={`h-3 w-3 mr-1 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

// Sync progress bar component
function SyncProgressBar({ isVisible }: { isVisible: boolean }) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      return;
    }
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div className="space-y-1" data-testid="sync-progress">
      <Progress value={progress} className="h-1.5" />
      <p className="text-xs text-muted-foreground">Syncing records...</p>
    </div>
  );
}

function ConnectionCard({ connection, onSync, onDelete, onRetry, onReconnect, isSyncing, isDeleting, isRetrying }: { 
  connection: EhrConnection; 
  onSync: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onReconnect: () => void;
  isSyncing: boolean;
  isDeleting: boolean;
  isRetrying: boolean;
}) {
  const platformInfo = ehrPlatformInfo[connection.platform as EhrPlatform];
  const effectiveStatus = isSyncing || isRetrying ? 'syncing' : connection.status;
  const canRetry = connection.status === 'error' && 
    (connection.syncSettings?.retryCount || 0) < (connection.syncSettings?.maxRetries || 3);
  const needsReconnect = connection.status === 'expired';

  return (
    <Card data-testid={`card-connection-${connection.id}`} className="overflow-hidden">
      <CardContent className="p-0">
        {/* Main row: Logo, Name, Status Pill, Actions */}
        <div className="flex items-center flex-wrap gap-4 p-4">
          {/* Logo */}
          <div 
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white font-bold text-lg"
            style={{ backgroundColor: platformInfo?.color || '#666' }}
            data-testid={`logo-${connection.id}`}
          >
            {platformInfo?.name?.[0] || connection.platform[0].toUpperCase()}
          </div>
          
          {/* Name and details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate" data-testid={`name-${connection.id}`}>
              {connection.facilityName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {platformInfo?.name || connection.platform}
              {connection.patientCount ? (
                <span className="ml-2 text-xs">
                  <Users className="inline h-3 w-3 mr-1" />
                  {connection.patientCount} patients
                </span>
              ) : null}
            </p>
          </div>
          
          {/* Status Pill */}
          <StatusPill status={effectiveStatus} />
          
          {/* Actions */}
          <div className="flex items-center flex-wrap gap-1 shrink-0">
            {!needsReconnect && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onSync}
                disabled={isSyncing || isRetrying || connection.status === 'syncing' || connection.status === 'expired'}
                data-testid={`button-sync-${connection.id}`}
                aria-label="Sync connection"
              >
                {isSyncing || isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid={`button-delete-${connection.id}`}
              aria-label="Delete connection"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Sync progress bar */}
        {(isSyncing || isRetrying || connection.status === 'syncing') && (
          <div className="px-4 pb-3">
            <SyncProgressBar isVisible={true} />
          </div>
        )}
        
        {/* Error message with retry button */}
        {connection.syncError && connection.status === 'error' && (
          <div className="px-4 pb-4">
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <span>{connection.syncError}</span>
                {canRetry && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onRetry}
                    disabled={isRetrying}
                    data-testid={`button-retry-${connection.id}`}
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
            {!canRetry && (
              <p className="text-xs text-muted-foreground mt-2">
                Maximum retry attempts reached. Please check your connection settings.
              </p>
            )}
          </div>
        )}

        {/* Expired connection with reconnect button */}
        {needsReconnect && (
          <div className="px-4 pb-4">
            <Alert className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <span>Your authorization has expired. Please reconnect to continue syncing.</span>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={onReconnect}
                  data-testid={`button-reconnect-${connection.id}`}
                >
                  <Link2 className="h-3 w-3 mr-1" />
                  Reconnect
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Partial sync info */}
        {connection.lastSyncResult?.partialSync && connection.status === 'connected' && (
          <div className="px-4 pb-3">
            <Alert className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Some records could not be synced. {connection.lastSyncResult.errors.length} items had issues.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        {/* Last sync info and sync settings */}
        {!isSyncing && !isRetrying && connection.status !== 'syncing' && connection.lastSync && (
          <div className="px-4 pb-3 border-t">
            <div className="pt-3 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last synced: {new Date(connection.lastSync).toLocaleString()}
              </p>
              {connection.syncSettings?.autoSyncEnabled && connection.syncSettings?.syncInterval !== 'manual' && (
                <Badge variant="secondary" className="text-xs">
                  Auto-sync: {formatSyncInterval(connection.syncSettings.syncInterval)}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to format sync interval for display
function formatSyncInterval(interval: string): string {
  switch (interval) {
    case "15min": return "Every 15 min";
    case "30min": return "Every 30 min";
    case "1hour": return "Every hour";
    case "4hours": return "Every 4 hours";
    case "12hours": return "Every 12 hours";
    case "24hours": return "Daily";
    case "manual": return "Manual only";
    default: return interval;
  }
}

const PLATFORM_URL_HINTS: Partial<Record<EhrPlatform, string>> = {
  ecw: "https://fhir4.eclinicalworks.com/fhir/r4/YOUR_TENANT",
  athena: "https://api.platform.athenahealth.com/fhir/r4",
  meditech: "https://your-hospital.meditech.com/fhir/r4",
};

function AddConnectionDialog({ onInitiateOAuth, testId = "button-add-connection" }: { 
  onInitiateOAuth: (data: { platform: EhrPlatform; facilityName: string; aud?: string }) => Promise<void>;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<EhrPlatform | "">("");
  const [facilityName, setFacilityName] = useState("");
  const [fhirBaseUrl, setFhirBaseUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const selectedPlatformInfo = platform ? ehrPlatformInfo[platform] : null;
  const showFhirUrl = platform && platform !== "fastenhealth" && platform !== "epic";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (platform) {
      setIsConnecting(true);
      try {
        await onInitiateOAuth({ 
          platform, 
          facilityName: facilityName || selectedPlatformInfo?.name || '',
          aud: fhirBaseUrl || undefined,
        });
        setOpen(false);
        setPlatform("");
        setFacilityName("");
        setFhirBaseUrl("");
      } finally {
        setIsConnecting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={testId}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Connect to EHR Platform</DialogTitle>
            <DialogDescription>
              Connect directly to your EHR system via SMART on FHIR.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="platform">EHR Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as EhrPlatform)}>
                <SelectTrigger id="platform" data-testid="select-platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {ehrPlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: ehrPlatformInfo[p]?.color }}
                        />
                        {ehrPlatformInfo[p]?.name || p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlatformInfo && (
                <p className="text-xs text-muted-foreground">{selectedPlatformInfo.description}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="facilityName">Facility Name (Optional)</Label>
              <Input
                id="facilityName"
                placeholder={selectedPlatformInfo?.name || "e.g., City General Hospital"}
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                data-testid="input-facility-name"
              />
            </div>

            {showFhirUrl && (
              <div className="space-y-2">
                <Label htmlFor="fhirBaseUrl">FHIR Server URL (Optional)</Label>
                <Input
                  id="fhirBaseUrl"
                  placeholder={PLATFORM_URL_HINTS[platform as EhrPlatform] || "https://..."}
                  value={fhirBaseUrl}
                  onChange={(e) => setFhirBaseUrl(e.target.value)}
                  data-testid="input-fhir-base-url"
                />
                <p className="text-xs text-muted-foreground">
                  Your provider's FHIR endpoint URL. Leave blank to use the default.
                </p>
              </div>
            )}

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Secure Authorization</AlertTitle>
              <AlertDescription>
                You will be redirected to the EHR platform to authorize access to your health records. 
                Your login credentials are never shared with this app.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-connection">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!platform || isConnecting} 
              data-testid="button-submit-connection"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with {selectedPlatformInfo?.name || 'EHR'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EpicEndpoint {
  name: string;
  baseUrl: string;
  managingOrganization?: string;
}

function EpicHospitalSearchDialog({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (endpoint: EpicEndpoint) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EpicEndpoint | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery<EpicEndpoint[]>({
    queryKey: ['/api/ehr-integration/epic/endpoints', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/ehr-integration/epic/endpoints?q=${encodeURIComponent(debouncedQuery)}`);
      const data = await res.json();
      return data.endpoints || [];
    },
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Find Your Hospital
          </DialogTitle>
          <DialogDescription>
            Search Epic's network to find and connect to your healthcare provider's patient portal.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-epic-hospital-search"
            placeholder="Search by hospital or health system name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedEndpoint(null);
            }}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[350px] border rounded-md">
          {!debouncedQuery || debouncedQuery.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
              <Search className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Type at least 2 characters to search</p>
              <p className="text-xs mt-1">Search across thousands of Epic-connected hospitals</p>
            </div>
          ) : searchResults.isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Searching hospitals...</span>
            </div>
          ) : searchResults.data && searchResults.data.length > 0 ? (
            <div className="divide-y">
              {searchResults.data.map((ep, idx) => (
                <button
                  key={`${ep.baseUrl}-${idx}`}
                  data-testid={`epic-endpoint-${idx}`}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                    selectedEndpoint?.baseUrl === ep.baseUrl ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                  }`}
                  onClick={() => setSelectedEndpoint(ep)}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">{ep.name}</p>
                      {ep.managingOrganization && ep.managingOrganization !== ep.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {ep.managingOrganization}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
              <AlertCircle className="h-6 w-6 mb-2 opacity-40" />
              <p className="text-sm">No hospitals found for "{debouncedQuery}"</p>
              <p className="text-xs mt-1">Try a different name or check spelling</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-epic-search-cancel">
            Cancel
          </Button>
          <Button 
            disabled={!selectedEndpoint}
            onClick={() => {
              if (selectedEndpoint) {
                onSelect(selectedEndpoint);
                onOpenChange(false);
              }
            }}
            data-testid="button-epic-search-connect"
          >
            {selectedEndpoint ? `Connect to ${selectedEndpoint.name.substring(0, 30)}${selectedEndpoint.name.length > 30 ? '...' : ''}` : 'Select a Hospital'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PRIORITY_HOSPITALS = [
  {
    name: "Inova Health System",
    baseUrl: "https://epicrpprd.inova.org/fhirrp/api/FHIR/R4/",
    region: "Northern Virginia",
  },
  {
    name: "UVA Health System",
    baseUrl: "https://hscsesoap.hscs.virginia.edu/FHIRProxy/api/FHIR/R4/",
    region: "Charlottesville, VA",
  },
  {
    name: "Sentara Healthcare",
    baseUrl: "https://epicfhir.sentara.com/ARR-FHIR-PRD/api/FHIR/R4/",
    region: "Hampton Roads, VA",
  },
];

function PriorityHospitalCard({ hospital, onConnect, isConnecting }: { 
  hospital: typeof PRIORITY_HOSPITALS[0]; 
  onConnect: (hospital: typeof PRIORITY_HOSPITALS[0]) => void; 
  isConnecting?: boolean;
}) {
  return (
    <div
      className="flex items-center flex-wrap gap-3 p-4 rounded-md border-2 border-primary/20 bg-primary/5 hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
      data-testid={`card-priority-hospital-${hospital.name.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={() => !isConnecting && onConnect(hospital)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onConnect(hospital); }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{hospital.name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {hospital.region}
        </p>
      </div>
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <ArrowRight className="h-4 w-4 text-primary opacity-50" />
      )}
    </div>
  );
}

function PlatformCard({ platform, onConnect, isConnecting }: { platform: EhrPlatform; onConnect: (platform: EhrPlatform) => void; isConnecting?: boolean }) {
  const info = ehrPlatformInfo[platform];
  
  return (
    <div 
      className="flex items-center flex-wrap gap-3 p-4 rounded-md border border-dashed hover-elevate cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
      data-testid={`card-platform-${platform}`}
      onClick={() => !isConnecting && onConnect(platform)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onConnect(platform); }}
    >
      <div 
        className="flex h-10 w-10 items-center justify-center rounded-md text-white font-bold"
        style={{ backgroundColor: info.color }}
      >
        {info.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{info.name}</p>
        <p className="text-xs text-muted-foreground">{isConnecting ? "Connecting..." : "Click to connect"}</p>
      </div>
      {isConnecting && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
    </div>
  );
}

// Wearable Device Card Component
function WearableConnectionCard({ connection, onSync, onDelete, isSyncing, isDeleting }: { 
  connection: WearableConnection; 
  onSync: () => void;
  onDelete: () => void;
  isSyncing: boolean;
  isDeleting: boolean;
}) {
  const platformInfo = wearablePlatformInfo[connection.platform as WearablePlatform];
  const effectiveStatus = isSyncing ? 'syncing' : connection.status;

  const formatLastSync = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const dataTypeIcons: Record<string, typeof Activity> = {
    steps: Activity,
    heart_rate: Heart,
    sleep: Moon,
    activity: Activity,
  };

  return (
    <Card data-testid={`card-wearable-${connection.id}`} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center flex-wrap gap-4 p-4">
          <div 
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white font-bold text-lg"
            style={{ backgroundColor: platformInfo?.color || '#666' }}
            data-testid={`wearable-logo-${connection.id}`}
          >
            {platformInfo?.icon || connection.platform[0].toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate" data-testid={`wearable-name-${connection.id}`}>
              {connection.deviceName || platformInfo?.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {platformInfo?.name || connection.platform}
            </p>
          </div>
          
          <StatusPill status={effectiveStatus} />
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onSync}
              disabled={isSyncing}
              data-testid={`button-sync-wearable-${connection.id}`}
              aria-label="Sync wearable"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid={`button-delete-wearable-${connection.id}`}
              aria-label="Delete wearable"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>
        
        <SyncProgressBar isVisible={isSyncing} />
        
        <div className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Last sync: {formatLastSync(connection.lastSync)}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1">
            {connection.enabledDataTypes.slice(0, 4).map((dt) => {
              const Icon = dataTypeIcons[dt] || Activity;
              return (
                <Badge key={dt} variant="outline" className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {dt.replace('_', ' ')}
                </Badge>
              );
            })}
            {connection.enabledDataTypes.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{connection.enabledDataTypes.length - 4} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Add Wearable Device Dialog
function AddWearableDialog({ testId, onConnect }: { 
  testId: string;
  onConnect: (data: { platform: WearablePlatform; deviceName: string; enabledDataTypes: WearableDataType[] }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<WearablePlatform | "">("");
  const [deviceName, setDeviceName] = useState("");
  const [enabledDataTypes, setEnabledDataTypes] = useState<WearableDataType[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const selectedPlatformInfo = platform ? wearablePlatformInfo[platform] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform) return;
    
    setIsConnecting(true);
    try {
      await onConnect({ 
        platform, 
        deviceName: deviceName || selectedPlatformInfo?.name || platform, 
        enabledDataTypes: enabledDataTypes.length > 0 ? enabledDataTypes : (selectedPlatformInfo?.dataTypes as WearableDataType[] || []),
      });
      setOpen(false);
      setPlatform("");
      setDeviceName("");
      setEnabledDataTypes([]);
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleDataType = (dataType: WearableDataType) => {
    setEnabledDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(dt => dt !== dataType) 
        : [...prev, dataType]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid={testId}>
          <Watch className="h-4 w-4 mr-2" />
          Connect Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Connect Wearable Device</DialogTitle>
            <DialogDescription>
              Connect your fitness tracker or health device to sync activity data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wearable-platform">Device Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as WearablePlatform)}>
                <SelectTrigger id="wearable-platform" data-testid="select-wearable-platform">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {wearablePlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: wearablePlatformInfo[p]?.color }}
                        />
                        {wearablePlatformInfo[p]?.name || p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlatformInfo && (
                <p className="text-xs text-muted-foreground">{selectedPlatformInfo.description}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deviceName">Device Name (Optional)</Label>
              <Input
                id="deviceName"
                placeholder={selectedPlatformInfo?.name || "e.g., My Fitbit"}
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                data-testid="input-device-name"
              />
            </div>

            {selectedPlatformInfo && (
              <div className="space-y-2">
                <Label>Data Types to Sync</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(selectedPlatformInfo.dataTypes as WearableDataType[]).map((dt) => (
                    <div key={dt} className="flex items-center gap-2">
                      <Checkbox
                        id={`dt-${dt}`}
                        checked={enabledDataTypes.includes(dt) || (enabledDataTypes.length === 0)}
                        onCheckedChange={() => toggleDataType(dt)}
                        data-testid={`checkbox-${dt}`}
                      />
                      <label htmlFor={`dt-${dt}`} className="text-sm capitalize">
                        {dt.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertTitle>Device Authorization</AlertTitle>
              <AlertDescription>
                You will be redirected to authorize access to your device data.
                This app only reads health metrics and never shares your data.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-wearable">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!platform || isConnecting} 
              data-testid="button-submit-wearable"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Device
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Wearable Platform Card
function WearablePlatformCard({ platform, onConnect }: { platform: WearablePlatform; onConnect: () => void }) {
  const info = wearablePlatformInfo[platform];
  
  return (
    <div 
      className="flex items-center flex-wrap gap-3 p-4 rounded-md border border-dashed hover-elevate cursor-pointer"
      onClick={onConnect}
      data-testid={`card-wearable-platform-${platform}`}
    >
      <div 
        className="flex h-10 w-10 items-center justify-center rounded-md text-white font-bold"
        style={{ backgroundColor: info.color }}
      >
        {info.icon}
      </div>
      <div>
        <p className="font-medium">{info.name}</p>
        <p className="text-xs text-muted-foreground">Click to connect</p>
      </div>
    </div>
  );
}

export default function Connections() {
  useSEO({
    title: "Data Sources",
    description: "Connect your hospitals, clinics, labs, and wearable devices to Tabula Medica. Supports SMART on FHIR, Epic MyChart, Cerner, athenahealth, and 25,000+ healthcare organizations.",
    canonicalPath: "/connections",
    structuredData: [
      ...buildPageSchemas({
        pageName: "Connect Health Records",
        pageDescription: "Connect your hospitals, clinics, labs, and wearable devices to Tabula Medica using SMART on FHIR.",
        pagePath: "/connections",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Dashboard", path: "/dashboard" },
          { name: "Data Sources", path: "/connections" },
        ],
      }),
      buildHowToSchema({
        name: "How to Connect Your Hospital Records to Tabula Medica",
        description: "Step-by-step guide to connecting your electronic health records from any FHIR-enabled hospital.",
        totalTime: "PT2M",
        steps: [
          { name: "Search for your hospital", text: "Type your hospital or health system name into the search bar to find your provider." },
          { name: "Log into your patient portal", text: "Authenticate through your hospital's official patient portal (e.g., MyChart) using OAuth." },
          { name: "Authorize data access", text: "Review and approve the data categories you want to share with Tabula Medica." },
          { name: "View your unified records", text: "Your medical records will sync automatically into your health timeline within minutes." },
        ],
      }),
    ],
  });

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [wearableSyncingIds, setWearableSyncingIds] = useState<Set<string>>(new Set());
  const [wearableDeletingIds, setWearableDeletingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"ehr" | "wearables">("ehr");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { entitlements, canAddFhirSource, isFree } = useSubscription();

  const { data: connections, isLoading } = useQuery<EhrConnection[]>({
    queryKey: ['/api/ehr-connections'],
  });

  const { data: wearableConnections, isLoading: isLoadingWearables } = useQuery<WearableConnection[]>({
    queryKey: ['/api/wearables/connections'],
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const connectedId = params.get('connected');
    const error = params.get('error');

    if (connectedId) {
      toast({
        title: "Connection Successful",
        description: "Your health record source has been connected. You can now sync your data.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ehr-connections'] });
      setLocation('/connections', { replace: true });
    }

    if (error) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      setLocation('/connections', { replace: true });
    }
  }, [searchString, toast, setLocation]);

  const [epicSearchOpen, setEpicSearchOpen] = useState(false);

  useEffect(() => {
    const pendingName = sessionStorage.getItem("pending_hospital_name");
    const pendingUrl = sessionStorage.getItem("pending_hospital_base_url");
    sessionStorage.removeItem("pending_hospital_name");
    sessionStorage.removeItem("pending_hospital_base_url");
    if (pendingName && pendingUrl) {
      setTimeout(() => {
        initiateOAuthForHospital(pendingName, pendingUrl);
      }, 500);
    }
  }, []);

  async function initiateOAuthForHospital(name: string, baseUrl: string) {
    try {
      const res = await apiRequest('POST', '/api/ehr-integration/auth/initiate', {
        platform: 'epic',
        userId: 'current-user',
        redirectUri: `${window.location.origin}/ehr-callback`,
        aud: baseUrl,
      });
      const result = await res.json();
      if (result.success && result.authorizationUrl) {
        sessionStorage.setItem('ehr_code_verifier', result.codeVerifier);
        sessionStorage.setItem('ehr_state', result.state);
        sessionStorage.setItem('ehr_platform', 'epic');
        sessionStorage.setItem('ehr_facility_name', name);
        window.location.href = result.authorizationUrl;
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Could not initiate hospital connection",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Connection Failed",
        description: "Could not connect to the hospital. Please try again.",
        variant: "destructive",
      });
    }
  }

  const initiateOAuthMutation = useMutation({
    mutationFn: async (data: { platform: EhrPlatform; facilityName: string; aud?: string }) => {
      if (data.platform === "fastenhealth") {
        window.location.href = "/fasten-connect";
        return {};
      }
      if (data.platform === "epic" && !data.aud) {
        setEpicSearchOpen(true);
        return {};
      }
      const res = await apiRequest('POST', '/api/ehr-integration/auth/initiate', {
        platform: data.platform,
        userId: 'current-user',
        redirectUri: `${window.location.origin}/ehr-callback`,
        ...(data.aud ? { aud: data.aud } : {}),
      });
      const result = await res.json();
      if (result.success && result.authorizationUrl) {
        sessionStorage.setItem('ehr_code_verifier', result.codeVerifier);
        sessionStorage.setItem('ehr_state', result.state);
        sessionStorage.setItem('ehr_platform', data.platform);
        sessionStorage.setItem('ehr_facility_name', data.facilityName);
        window.location.href = result.authorizationUrl;
      } else if (!result.success) {
        toast({
          title: "Connection Failed",
          description: result.error || `Could not initiate ${data.platform} connection`,
          variant: "destructive",
        });
      }
      return result;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingIds(prev => new Set(prev).add(id));
      return apiRequest('POST', `/api/ehr-connections/${id}/fhir-sync`, { triggerType: 'manual' });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ehr-connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: "Sync Complete",
        description: "Patient data has been synchronized successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync patient data. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingIds(prev => new Set(prev).add(id));
      return apiRequest('DELETE', `/api/ehr-connections/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ehr-connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: "Connection Removed",
        description: "EHR connection has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove EHR connection. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // Retry sync mutation
  const retrySyncMutation = useMutation({
    mutationFn: async (id: string) => {
      setRetryingIds(prev => new Set(prev).add(id));
      await apiRequest('POST', `/api/ehr-connections/${id}/retry-sync`, {});
      // Trigger actual sync after retry setup
      return apiRequest('POST', `/api/ehr-connections/${id}/fhir-sync`, { triggerType: 'retry' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ehr-connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      toast({
        title: "Sync Retried",
        description: "Data sync has been retried successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Retry Failed",
        description: "Failed to retry sync. Please check your connection.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // Reconnect expired connection mutation
  const reconnectMutation = useMutation({
    mutationFn: async (_connection: EhrConnection) => {
      window.location.href = "/fasten-connect";
      return {};
    },
    onError: () => {
      toast({
        title: "Reconnection Failed",
        description: "Failed to initiate reconnection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Wearable mutations
  const createWearableMutation = useMutation({
    mutationFn: async (data: { platform: WearablePlatform; deviceName: string; enabledDataTypes: WearableDataType[] }) => {
      const response = await apiRequest('POST', '/api/wearables/connections', {
        platform: data.platform,
        deviceName: data.deviceName,
        enabledDataTypes: data.enabledDataTypes,
        status: "connected",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wearables/connections'] });
      toast({
        title: "Device Connected",
        description: "Your wearable device has been connected successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncWearableMutation = useMutation({
    mutationFn: async (id: string) => {
      setWearableSyncingIds(prev => new Set(prev).add(id));
      return apiRequest('POST', `/api/wearables/connections/${id}/sync`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wearables/connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wearables/data'] });
      toast({
        title: "Sync Complete",
        description: "Device data has been synchronized successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync device data. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setWearableSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const deleteWearableMutation = useMutation({
    mutationFn: async (id: string) => {
      setWearableDeletingIds(prev => new Set(prev).add(id));
      return apiRequest('DELETE', `/api/wearables/connections/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wearables/connections'] });
      toast({
        title: "Device Removed",
        description: "Wearable device has been disconnected successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove device. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: (_, __, id) => {
      setWearableDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const connectedPlatforms = new Set(connections?.map(c => c.platform) || []);
  const availablePlatforms = ehrPlatforms.filter(p => !connectedPlatforms.has(p));
  const connectedWearables = new Set(wearableConnections?.map(c => c.platform) || []);
  const availableWearables = wearablePlatforms.filter(p => !connectedWearables.has(p));

  const currentFhirCount = connections?.length ?? 0;
  const fhirLimit = entitlements?.limits.fhirSources ?? 1;
  const atFhirLimit = !canAddFhirSource(currentFhirCount);

  const handleAddConnectionAttempt = (data: { platform: EhrPlatform; facilityName: string; aud?: string }) => {
    if (atFhirLimit) {
      setShowUpgradeDialog(true);
      return Promise.resolve();
    }
    return initiateOAuthMutation.mutateAsync(data);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        trigger="fhir_limit"
        currentUsage={currentFhirCount}
        limit={fhirLimit}
        upgradePrice={entitlements?.upgradePrice}
        trialDays={entitlements?.trialDays}
      />
      <EpicHospitalSearchDialog
        open={epicSearchOpen}
        onOpenChange={setEpicSearchOpen}
        onSelect={(endpoint) => {
          if (atFhirLimit) {
            setEpicSearchOpen(false);
            setShowUpgradeDialog(true);
            return;
          }
          initiateOAuthMutation.mutate({
            platform: "epic",
            facilityName: endpoint.name,
            aud: endpoint.baseUrl,
          });
        }}
      />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Sources</h1>
            <p className="text-muted-foreground">Manage connections to health records and devices</p>
          </div>
          {isFree && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-free-tier-status">
              <span>{currentFhirCount}/{fhirLimit} connection{fhirLimit !== 1 ? "s" : ""} used</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ehr" | "wearables")} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ehr" data-testid="tab-ehr">
              <Database className="h-4 w-4 mr-2" />
              EHR Platforms
            </TabsTrigger>
            <TabsTrigger value="wearables" data-testid="tab-wearables">
              <Watch className="h-4 w-4 mr-2" />
              Wearable Devices
            </TabsTrigger>
          </TabsList>

          {/* EHR Tab */}
          <TabsContent value="ehr" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-semibold">Active EHR Connections</h2>
              <AddConnectionDialog 
                testId="button-add-connection-header"
                onInitiateOAuth={handleAddConnectionAttempt} 
              />
            </div>

            {isFree && currentFhirCount > 0 && (
              <InlineFhirLimitBanner
                used={currentFhirCount}
                limit={fhirLimit}
                upgradePrice={entitlements?.upgradePrice}
                trialDays={entitlements?.trialDays}
              />
            )}
            
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array(2).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3 mb-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-9 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : connections?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {connections.map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    onSync={() => syncMutation.mutate(connection.id)}
                    onDelete={() => deleteMutation.mutate(connection.id)}
                    onRetry={() => retrySyncMutation.mutate(connection.id)}
                    onReconnect={() => reconnectMutation.mutate(connection)}
                    isSyncing={syncingIds.has(connection.id)}
                    isDeleting={deletingIds.has(connection.id)}
                    isRetrying={retryingIds.has(connection.id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed" data-testid="empty-ehr-state">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Database className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No health record sources</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Connect to your healthcare providers to automatically sync your medical records, lab results, and more.
                  </p>
                  <AddConnectionDialog 
                    testId="button-add-connection-empty"
                    onInitiateOAuth={handleAddConnectionAttempt} 
                  />
                </CardContent>
              </Card>
            )}

            {atFhirLimit && isFree && currentFhirCount > 0 && (
              <SoftUpgradePrompt
                trigger="fhir_limit"
                currentUsage={currentFhirCount}
                limit={fhirLimit}
                upgradePrice={entitlements?.upgradePrice}
                trialDays={entitlements?.trialDays}
              />
            )}

            {/* Fasten Health Recommended Section */}
            {availablePlatforms.includes("fastenhealth") && (
              <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="card-fastenhealth-recommended">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start gap-4">
                    <div 
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xl"
                      style={{ backgroundColor: ehrPlatformInfo.fastenhealth.color }}
                    >
                      <Network className="h-7 w-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">Fasten Health</h3>
                        <Badge variant="secondary" className="shrink-0">
                          <Zap className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-4">
                        Connect to multiple healthcare providers through a single integration. Fasten Health provides access to a nationwide network of labs, imaging centers, and healthcare organizations.
                      </p>
                      <div className="flex flex-wrap items-center gap-4">
                        <Button
                          onClick={() => initiateOAuthMutation.mutate({ platform: "fastenhealth", facilityName: "Fasten Health Network" })}
                          disabled={initiateOAuthMutation.isPending}
                          data-testid="button-connect-fastenhealth"
                        >
                          {initiateOAuthMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Connect Now
                            </>
                          )}
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          Secure connection via Fasten Health
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Priority Hospitals</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Quick-connect to featured health systems via SMART on FHIR
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PRIORITY_HOSPITALS.map((hospital) => (
                  <PriorityHospitalCard
                    key={hospital.name}
                    hospital={hospital}
                    onConnect={(h) => initiateOAuthMutation.mutate({ 
                      platform: "epic", 
                      facilityName: h.name, 
                      aud: h.baseUrl 
                    })}
                    isConnecting={initiateOAuthMutation.isPending}
                  />
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setEpicSearchOpen(true)}
                data-testid="button-search-all-hospitals"
              >
                <Search className="h-4 w-4 mr-2" />
                Search All Epic Hospitals
              </Button>
            </div>

            {availablePlatforms.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Other EHR Platforms</h2>
                <p className="text-sm text-muted-foreground">
                  Connect to additional EHR platforms to aggregate more patient data
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {availablePlatforms.filter(p => p !== "fastenhealth").map((platform) => (
                    <PlatformCard 
                      key={platform} 
                      platform={platform} 
                      onConnect={(p) => initiateOAuthMutation.mutate({ platform: p, facilityName: ehrPlatformInfo[p].name })}
                      isConnecting={initiateOAuthMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Wearables Tab */}
          <TabsContent value="wearables" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-semibold">Connected Devices</h2>
              <AddWearableDialog 
                testId="button-add-wearable-header"
                onConnect={async (data) => {
                  await createWearableMutation.mutateAsync(data);
                }} 
              />
            </div>
            
            {isLoadingWearables ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array(2).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3 mb-4">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : wearableConnections?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {wearableConnections.map((connection) => (
                  <WearableConnectionCard
                    key={connection.id}
                    connection={connection}
                    onSync={() => syncWearableMutation.mutate(connection.id)}
                    onDelete={() => deleteWearableMutation.mutate(connection.id)}
                    isSyncing={wearableSyncingIds.has(connection.id)}
                    isDeleting={wearableDeletingIds.has(connection.id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed" data-testid="empty-wearables-state">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Watch className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No wearable devices</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Connect your fitness trackers and health devices to sync activity, sleep, and heart rate data.
                  </p>
                  <AddWearableDialog 
                    testId="button-add-wearable-empty"
                    onConnect={async (data) => {
                      await createWearableMutation.mutateAsync(data);
                    }} 
                  />
                </CardContent>
              </Card>
            )}

            {availableWearables.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Available Devices</h2>
                <p className="text-sm text-muted-foreground">
                  Connect additional wearable devices to track more health metrics
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {availableWearables.map((platform) => (
                    <WearablePlatformCard 
                      key={platform} 
                      platform={platform} 
                      onConnect={() => setActiveTab("wearables")}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-connections-disclaimer" />
      </div>
    </div>
  );
}
