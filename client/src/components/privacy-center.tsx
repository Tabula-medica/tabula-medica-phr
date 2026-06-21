import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Database,
  Download,
  Trash2,
  RefreshCw,
  Link2,
  Link2Off,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Activity,
  History,
  Eye,
  Lock,
  ChevronRight,
  Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectedSource {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error" | "syncing";
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  recordsImported: number;
  connectedAt: string;
  permissions: string[];
}

interface DataExportRequest {
  id: string;
  format: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
}

interface PrivacyStats {
  connectedSources: number;
  totalRecords: number;
  lastActivity: string | null;
  pendingExports: number;
  dataCategories: Array<{ name: string; count: number }>;
}

interface AccessLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface DataCategory {
  name: string;
  description: string;
  itemCount: number;
  lastUpdated: string | null;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  connected: { icon: CheckCircle2, color: "text-green-600", label: "Connected" },
  disconnected: { icon: Link2Off, color: "text-gray-500", label: "Disconnected" },
  error: { icon: AlertCircle, color: "text-red-600", label: "Error" },
  syncing: { icon: Loader2, color: "text-blue-600", label: "Syncing" },
};

const typeIcons: Record<string, typeof Server> = {
  ehr: Server,
  pharmacy: FileText,
  lab: Activity,
  insurance: Shield,
  wearable: Activity,
  manual: FileText,
};

function SourceCard({
  source,
  onRevoke,
  onReconnect,
}: {
  source: ConnectedSource;
  onRevoke: () => void;
  onReconnect: () => void;
}) {
  const config = statusConfig[source.status] || statusConfig.disconnected;
  const StatusIcon = config.icon;
  const TypeIcon = typeIcons[source.type] || Server;

  return (
    <div className="p-4 rounded-lg border" data-testid={`source-card-${source.id}`}>
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <TypeIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" data-testid={`text-source-name-${source.id}`}>
              {source.name}
            </p>
            <div className={`flex items-center gap-1 ${config.color}`}>
              <StatusIcon className={`h-4 w-4 ${source.status === "syncing" ? "animate-spin" : ""}`} />
              <span className="text-xs">{config.label}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {source.permissions.slice(0, 3).map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {p}
              </Badge>
            ))}
            {source.permissions.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{source.permissions.length - 3}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{source.recordsImported} records</span>
            {source.lastSyncAt && (
              <>
                <span>•</span>
                <span>Last sync: {new Date(source.lastSyncAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {source.status === "disconnected" ? (
            <Button size="sm" variant="outline" onClick={onReconnect} data-testid={`button-reconnect-${source.id}`}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Reconnect
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-red-600" data-testid={`button-revoke-${source.id}`}>
                  <Link2Off className="h-4 w-4 mr-1" />
                  Revoke
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect {source.name} from your account. No new data will be synced. Your existing
                    records will remain but won't be updated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRevoke} data-testid="button-confirm-revoke">
                    Revoke Access
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

function DataExportSection() {
  const { toast } = useToast();
  const [format, setFormat] = useState<string>("pdf");

  const { data: exports, isLoading } = useQuery<DataExportRequest[]>({
    queryKey: ["/api/privacy/exports"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/privacy/exports", {
        format,
        categories: ["all"],
      });
      if (!response.ok) throw new Error("Failed to request export");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/exports"] });
      toast({
        title: "Export Requested",
        description: "Your data export is being prepared. This may take a few minutes.",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Download Your Data</h4>
          <p className="text-sm text-muted-foreground">Export all your health records in your preferred format</p>
        </div>
        <div className="flex gap-2">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-[120px]" data-testid="select-export-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf" data-testid="option-pdf">PDF</SelectItem>
              <SelectItem value="json" data-testid="option-json">JSON</SelectItem>
              <SelectItem value="fhir" data-testid="option-fhir">FHIR R4</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} data-testid="button-export-data">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : exports && exports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Recent Exports</p>
          {exports.slice(0, 3).map((exp) => (
            <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`export-${exp.id}`}>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{exp.format.toUpperCase()} Export</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(exp.requestedAt).toLocaleDateString()}
                    {exp.expiresAt && ` • Expires ${new Date(exp.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              {exp.status === "completed" && exp.downloadUrl ? (
                <Button size="sm" variant="outline" asChild data-testid={`button-download-${exp.id}`}>
                  <a href={exp.downloadUrl}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </a>
                </Button>
              ) : exp.status === "processing" ? (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processing
                </Badge>
              ) : (
                <Badge variant="secondary">{exp.status}</Badge>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccessLogSection() {
  const { data: logs, isLoading } = useQuery<AccessLog[]>({
    queryKey: ["/api/privacy/access-logs"],
  });

  const actionIcons: Record<string, typeof Eye> = {
    login: Lock,
    view_records: Eye,
    export_data: Download,
    share_records: Link2,
    connect_source: Link2,
    revoke_access: Link2Off,
    delete_request: Trash2,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>Recent account activity</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : logs && logs.length > 0 ? (
        <ScrollArea className="h-[250px]">
          <div className="space-y-2 pr-4">
            {logs.map((log) => {
              const ActionIcon = actionIcons[log.action] || Activity;
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`log-${log.id}`}>
                  <ActionIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">{log.details}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent activity</p>
        </div>
      )}
    </div>
  );
}

function DataSummarySection() {
  const { data, isLoading } = useQuery<{ categories: DataCategory[] }>({
    queryKey: ["/api/privacy/data-summary"],
  });

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-medium">Your Data at a Glance</h4>
        <p className="text-sm text-muted-foreground">Overview of information stored in your account</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : data?.categories ? (
        <div className="grid grid-cols-2 gap-2">
          {data.categories.map((cat, i) => (
            <div key={i} className="p-3 rounded-lg border" data-testid={`category-${i}`}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{cat.name}</p>
                <Badge variant="secondary">{cat.itemCount}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
              {cat.lastUpdated && (
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(cat.lastUpdated).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeleteAccountSection() {
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/privacy/delete-account", {});
      if (!response.ok) throw new Error("Failed to request deletion");
      return response.json();
    },
    onSuccess: () => {
      setShowConfirm(false);
      toast({
        title: "Deletion Requested",
        description: "Check your email for confirmation. You have 24 hours to cancel this request.",
      });
    },
  });

  return (
    <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
      <div className="flex items-start gap-4">
        <Trash2 className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-red-700 dark:text-red-400">Delete Account</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-3 border-red-300 text-red-600 hover:bg-red-50" data-testid="button-delete-account">
                Request Account Deletion
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your health records. This action cannot be undone.
                  You will receive an email to confirm this request.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-confirm-delete"
                >
                  Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export function PrivacyCenter() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sources");

  const { data: sources, isLoading: sourcesLoading } = useQuery<ConnectedSource[]>({
    queryKey: ["/api/privacy/sources"],
    enabled: open,
  });

  const { data: stats } = useQuery<PrivacyStats>({
    queryKey: ["/api/privacy/stats"],
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await apiRequest("DELETE", `/api/privacy/sources/${sourceId}`, {});
      if (!response.ok) throw new Error("Failed to revoke");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
      toast({ title: "Access Revoked" });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await apiRequest("POST", `/api/privacy/sources/${sourceId}/reconnect`, {});
      if (!response.ok) throw new Error("Failed to reconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/sources"] });
      toast({ title: "Reconnecting...", description: "Sync will begin shortly" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-privacy-center">
          <Shield className="h-4 w-4" />
          Privacy Center
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Center
          </DialogTitle>
          <DialogDescription>You control your data. Manage connections, exports, and privacy settings.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {stats && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold" data-testid="text-stat-sources">
                  {stats.connectedSources}
                </p>
                <p className="text-xs text-muted-foreground">Sources</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold" data-testid="text-stat-records">
                  {stats.totalRecords.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Records</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold" data-testid="text-stat-categories">
                  {stats.dataCategories.length}
                </p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xl font-bold" data-testid="text-stat-exports">
                  {stats.pendingExports}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sources" data-testid="tab-sources">Sources</TabsTrigger>
              <TabsTrigger value="data" data-testid="tab-data">My Data</TabsTrigger>
              <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-3">
              {sourcesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : sources && sources.length > 0 ? (
                <ScrollArea className="h-[320px]">
                  <div className="space-y-3 pr-4">
                    {sources.map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        onRevoke={() => revokeMutation.mutate(source.id)}
                        onReconnect={() => reconnectMutation.mutate(source.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No connected sources</p>
                  <p className="text-sm">Connect your health providers to import records</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="data">
              <ScrollArea className="h-[320px] pr-4">
                <DataSummarySection />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <DataExportSection />
              <Separator />
              <DeleteAccountSection />
            </TabsContent>

            <TabsContent value="activity">
              <AccessLogSection />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PrivacyCenterCard() {
  const { data: stats } = useQuery<PrivacyStats>({
    queryKey: ["/api/privacy/stats"],
  });

  return (
    <Card data-testid="card-privacy-center">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Privacy Center
        </CardTitle>
        <CardDescription>You control your data</CardDescription>
      </CardHeader>
      <CardContent>
        <PrivacyCenter />
        {stats && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{stats.connectedSources} connected sources</span>
            <span>•</span>
            <span>{stats.totalRecords.toLocaleString()} records</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
