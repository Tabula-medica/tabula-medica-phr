import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTefcaEnabled } from "@/hooks/use-tefca";
import {
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  Database,
  Loader2,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EHRConnection {
  id: string;
  userId: string;
  platform: string;
  displayName: string;
  status: "disconnected" | "pending_auth" | "authenticating" | "connected" | "syncing" | "error" | "expired";
  patientFhirId?: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncEnabled: boolean;
  errorMessage?: string;
  resourcesAvailable: string[];
  resourcesCached: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

interface EHRConnectionsProps {
  userId: string;
  onDataUpdated?: () => void;
}

export function EHRConnectionsCard({ userId, onDataUpdated }: EHRConnectionsProps) {
  const tefcaEnabled = useTefcaEnabled();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectConnection, setDisconnectConnection] = useState<EHRConnection | null>(null);

  const { data: connectionsData, isLoading: loadingConnections, refetch: refetchConnections } = useQuery<{ success: boolean; connections: EHRConnection[] }>({
    queryKey: ["/api/ehr-integration/connections", userId],
    queryFn: async () => {
      const res = await fetch(`/api/ehr-integration/connections?userId=${encodeURIComponent(userId)}`);
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/ehr-integration/connections/${connectionId}/sync`, { userId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${Object.values(data.resourcesSynced as Record<string, number>).reduce((a, b) => a + b, 0)} records`,
        });
        refetchConnections();
        onDataUpdated?.();
      }
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Failed to sync health records", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/ehr-integration/connections/${connectionId}/disconnect`, { userId });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Disconnected", description: "Successfully disconnected from Fasten Health" });
      refetchConnections();
      setDisconnectConnection(null);
      onDataUpdated?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disconnect", variant: "destructive" });
    },
  });

  const handleConnect = () => {
    window.location.href = "/fasten-connect";
  };

  const getStatusBadge = (status: EHRConnection["status"]) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case "syncing":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Syncing</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "expired":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case "pending_auth":
      case "authenticating":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Authenticating</Badge>;
      default:
        return <Badge variant="secondary"><Unlink className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  const connections = connectionsData?.connections || [];
  const hasConnections = connections.length > 0;

  // TEFCA / Fasten Health external-records connection is US-only. On the
  // international (.world) deployment (TEFCA_ENABLED=false) this card is hidden.
  if (!tefcaEnabled) {
    return null;
  }

  return (
    <Card className="w-full" data-testid="card-ehr-connections">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-ehr-title">Connected Health Records</CardTitle>
              <CardDescription>
                Securely import records from 25,000+ US healthcare providers via Fasten Health
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            HIPAA Compliant
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingConnections ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : hasConnections ? (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="p-4 rounded-lg border bg-card"
                data-testid={`ehr-connection-${connection.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium" data-testid={`text-connection-name-${connection.id}`}>{connection.displayName}</div>
                      <div className="text-sm text-muted-foreground">Fasten Health</div>
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>

                {connection.lastSyncAt && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Last synced {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}
                  </div>
                )}

                {connection.errorMessage && (
                  <div className="mt-3 p-2 rounded bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {connection.errorMessage}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncMutation.mutate(connection.id)}
                    disabled={syncMutation.isPending || connection.status === "syncing"}
                    data-testid={`button-sync-${connection.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDisconnectConnection(connection)}
                    data-testid={`button-disconnect-${connection.id}`}
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1" data-testid="text-no-connections">No Connected Health Records</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your health records to see all your medical information in one place.
            </p>
          </div>
        )}

        <Separator />

        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full max-w-sm"
            data-testid="button-connect-fastenhealth"
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            {hasConnections ? "Connect Another Source" : "Connect with Fasten Health"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Access records from 25,000+ US healthcare providers
          </p>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Secure Connection:</strong> Your health records are transferred securely via Fasten Health. We never store your login credentials.
            </div>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={!!disconnectConnection} onOpenChange={() => setDisconnectConnection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Health Records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to {disconnectConnection?.displayName}. Your synced records will no longer update automatically. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectConnection && disconnectMutation.mutate(disconnectConnection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default EHRConnectionsCard;
