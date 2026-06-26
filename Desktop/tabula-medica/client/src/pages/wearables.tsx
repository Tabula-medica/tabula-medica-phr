/**
 * WEARABLES folder (auth'd patient portal).
 * Connect standard wearable devices, see synced metrics, and share with a
 * provider. Backed by the durable wearable connection/data store (C1) via the
 * existing /api/wearables/* endpoints.
 */
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Watch, Heart, Footprints, Moon, Share2, Plug, Loader2, Unplug } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLATFORMS: { id: string; name: string }[] = [
  { id: "fitbit", name: "Fitbit" },
  { id: "apple_health", name: "Apple Health" },
  { id: "google_fit", name: "Google Fit" },
  { id: "garmin", name: "Garmin" },
  { id: "oura", name: "Oura" },
  { id: "withings", name: "Withings" },
  { id: "samsung_health", name: "Samsung Health" },
  { id: "whoop", name: "Whoop" },
];

const METRIC_ICON: Record<string, any> = { steps: Footprints, heart_rate: Heart, sleep: Moon, activity: Activity };

export default function Wearables() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const connectionsQ = useQuery<any[]>({ queryKey: ["/api/wearables/connections"] });
  const summaryQ = useQuery<any>({ queryKey: ["/api/wearables/summary"] });

  const connect = useMutation({
    mutationFn: (platform: string) => apiRequest("POST", "/api/wearables/connect", { platform, provider: platform }).then((r) => r.json()),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/wearables/connections"] });
      if (res?.oauthUrl || res?.authUrl) window.location.href = res.oauthUrl || res.authUrl;
      else toast({ title: "Device connected" });
    },
    onError: () => toast({ title: "Could not connect device", variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: (connectionId: string) => apiRequest("POST", "/api/wearables/disconnect", { connectionId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/wearables/connections"] }); toast({ title: "Device disconnected" }); },
  });

  const connections = connectionsQ.data ?? [];
  const connectedPlatforms = new Set(connections.map((c) => c.platform));
  const summary = summaryQ.data?.summary ?? {};

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Watch className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Wearables</h1>
            <p className="text-sm text-muted-foreground">Connect your fitness devices and share the data with your care team.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/care/share-records")}>
          <Share2 className="h-4 w-4 mr-1" /> Share with provider
        </Button>
      </div>

      {/* Connected devices */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Connected devices</CardTitle></CardHeader>
        <CardContent>
          {connectionsQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> :
            connections.length === 0 ? <p className="text-sm text-muted-foreground">No devices connected yet.</p> :
              connections.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium capitalize">{(c.platform || "").replace(/_/g, " ")}</span>
                    {c.deviceName && <span className="text-muted-foreground"> · {c.deviceName}</span>}
                    <Badge variant={c.status === "connected" ? "secondary" : "outline"} className="ml-2">{c.status}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => disconnect.mutate(c.id)}><Unplug className="h-4 w-4 mr-1" />Disconnect</Button>
                </div>
              ))}
        </CardContent>
      </Card>

      {/* Synced metrics */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Recent metrics</CardTitle>
          <CardDescription>Educational summary only — not medical advice.</CardDescription></CardHeader>
        <CardContent>
          {Object.keys(summary).length === 0 ? <p className="text-sm text-muted-foreground">No synced data yet. Connect a device to see metrics.</p> :
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(summary).map(([k, v]) => {
                const Icon = METRIC_ICON[k] || Activity;
                const display = typeof v === "object" && v !== null ? ((v as any).value ?? (v as any).latest ?? JSON.stringify(v)) : String(v);
                return (
                  <div key={k} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs capitalize"><Icon className="h-4 w-4" />{k.replace(/_/g, " ")}</div>
                    <div className="text-lg font-semibold mt-1 truncate">{display}</div>
                  </div>
                );
              })}
            </div>}
        </CardContent>
      </Card>

      {/* Connect standard devices */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plug className="h-4 w-4" />Connect a device</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLATFORMS.map((p) => {
            const isConnected = connectedPlatforms.has(p.id);
            return (
              <Button key={p.id} variant={isConnected ? "secondary" : "outline"} disabled={isConnected || connect.isPending}
                onClick={() => connect.mutate(p.id)} className="justify-start">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{p.name}{isConnected ? " ✓" : ""}
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
