import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Watch, ShieldCheck, Trash2, Loader2, ExternalLink, HeartPulse, Info } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FitnessProvider, FitnessConnection, RpmDevice, RpmMonitoringDeviceType } from "@shared/schema";

const PROVIDER_LABELS: Record<FitnessProvider, string> = {
  apple_health: "Apple Health",
  google_fit: "Google Fit",
  fitbit: "Fitbit",
  oura: "Oura Ring",
  garmin: "Garmin",
  whoop: "WHOOP",
  samsung_health: "Samsung Health",
  withings: "Withings",
  polar: "Polar",
  strava: "Strava",
};

const DEVICE_TYPE_LABELS: Record<RpmMonitoringDeviceType, string> = {
  blood_pressure_cuff: "Blood pressure cuff",
  glucometer: "Glucose meter",
  pulse_oximeter: "Pulse oximeter (SpO2)",
  scale: "Scale",
  thermometer: "Thermometer",
};

function FitnessConnectionsSection() {
  const { toast } = useToast();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const status = params.get("fitness");
    if (status === "connected") {
      toast({ title: "Fitness app connected", description: "We'll start reading your data shortly." });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/connections"] });
    } else if (status === "error") {
      toast({ title: "Connection failed", description: "The connection wasn't completed. Try again.", variant: "destructive" });
    }
  }, [search, toast]);

  const providersQuery = useQuery<{ success: boolean; configured: boolean; providers: { provider: FitnessProvider; readOnly: boolean }[] }>({
    queryKey: ["/api/fitness/providers"],
  });

  const connectionsQuery = useQuery<{ success: boolean; connections: FitnessConnection[] }>({
    queryKey: ["/api/fitness/connections"],
  });

  const connectMutation = useMutation({
    mutationFn: async (provider: FitnessProvider) => {
      const res = await apiRequest("POST", "/api/fitness/connect", { provider });
      return res.json() as Promise<{ success: boolean; widgetUrl?: string; error?: string }>;
    },
    onSuccess: (data) => {
      if (data.widgetUrl) {
        window.location.href = data.widgetUrl;
      } else {
        toast({ title: "Couldn't start connection", description: data.error || "Try again shortly.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Couldn't start connection", description: err?.message || "Try again shortly.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/fitness/connections/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/connections"] });
      toast({ title: "Disconnected" });
    },
  });

  const connections = connectionsQuery.data?.connections || [];
  const connectedProviders = new Set(connections.filter((c) => c.status === "connected").map((c) => c.provider));

  return (
    <Card data-testid="card-fitness-connections">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Watch className="h-5 w-5" />
          Fitness apps
        </CardTitle>
        <CardDescription>
          Connect a fitness app or wearable to bring steps, sleep, heart rate, and weight into your record.
          Every connection here is <strong>read-only</strong> — we can never change anything in your Fitbit,
          Garmin, Oura, or other connected account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providersQuery.data && !providersQuery.data.configured && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Not set up yet</AlertTitle>
            <AlertDescription>
              Fitness app connections aren't configured on this deployment yet. An administrator needs to add
              Terra API credentials.
            </AlertDescription>
          </Alert>
        )}

        {providersQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="grid-fitness-providers">
            {(providersQuery.data?.providers || []).map(({ provider }) => {
              const isConnected = connectedProviders.has(provider);
              return (
                <Button
                  key={provider}
                  type="button"
                  variant={isConnected ? "secondary" : "outline"}
                  className="h-auto flex-col items-start gap-1 py-3"
                  disabled={isConnected || connectMutation.isPending}
                  onClick={() => connectMutation.mutate(provider)}
                  data-testid={`button-connect-${provider}`}
                >
                  <span className="font-medium">{PROVIDER_LABELS[provider]}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    {isConnected ? "Connected" : "Read-only"}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {connections.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {connections
              .filter((c) => c.status !== "disconnected")
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid={`row-connection-${connection.id}`}
                >
                  <div>
                    <div className="font-medium">{PROVIDER_LABELS[connection.provider as FitnessProvider] || connection.provider}</div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-2">Read-only</Badge>
                      {connection.status}
                      {connection.lastSyncAt ? ` · last synced ${new Date(connection.lastSyncAt).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => disconnectMutation.mutate(connection.id)}
                    disabled={disconnectMutation.isPending}
                    data-testid={`button-disconnect-${connection.id}`}
                  >
                    {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RpmDevicesSection() {
  const { toast } = useToast();

  const devicesQuery = useQuery<{ success: boolean; devices: RpmDevice[] }>({
    queryKey: ["/api/rpm/devices"],
  });

  const enrollMutation = useMutation({
    mutationFn: (payload: { deviceType: RpmMonitoringDeviceType; externalDeviceId: string; serialNumber?: string }) =>
      apiRequest("POST", "/api/rpm/devices", { provider: "vitalfriend", ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rpm/devices"] });
      toast({ title: "Device added", description: "Readings from this device will now appear in your vitals." });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't add device", description: err?.message || "Check the device ID and try again.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rpm/devices/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rpm/devices"] });
      toast({ title: "Device removed" });
    },
  });

  const devices = (devicesQuery.data?.devices || []).filter((d) => d.status !== "inactive");

  return (
    <Card data-testid="card-rpm-devices">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          Remote patient monitoring devices
        </CardTitle>
        <CardDescription>
          Pair a VitalFriend cellular monitoring device (blood pressure cuff, glucose meter, pulse oximeter,
          or scale). Readings are added to your vitals automatically and reviewed the same way as anything you
          log yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const deviceType = (form.elements.namedItem("deviceType") as HTMLSelectElement)?.value as RpmMonitoringDeviceType;
            const externalDeviceId = (form.elements.namedItem("externalDeviceId") as HTMLInputElement)?.value?.trim();
            if (!deviceType || !externalDeviceId) return;
            enrollMutation.mutate({ deviceType, externalDeviceId });
            form.reset();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="deviceType">Device type</Label>
            <Select name="deviceType" required>
              <SelectTrigger id="deviceType" data-testid="select-device-type">
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="externalDeviceId">Device ID (printed on the device)</Label>
            <Input id="externalDeviceId" name="externalDeviceId" required data-testid="input-device-id" />
          </div>
          <Button type="submit" disabled={enrollMutation.isPending} data-testid="button-add-device">
            {enrollMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add device"}
          </Button>
        </form>

        {devicesQuery.isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RPM devices added yet.</p>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`row-device-${device.id}`}>
                <div>
                  <div className="font-medium">{DEVICE_TYPE_LABELS[device.deviceType as RpmMonitoringDeviceType] || device.deviceType}</div>
                  <div className="text-xs text-muted-foreground">
                    ID {device.externalDeviceId} · {device.status}
                    {device.lastReadingAt ? ` · last reading ${new Date(device.lastReadingAt).toLocaleString()}` : " · no readings yet"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMutation.mutate(device.id)}
                  disabled={removeMutation.isPending}
                  data-testid={`button-remove-device-${device.id}`}
                >
                  {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FitnessRpmConnections() {
  useSEO({
    title: "Fitness Apps & Remote Monitoring",
    description: "Connect fitness apps read-only and pair remote patient monitoring devices.",
  });

  return (
    <div className="container max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fitness apps & remote monitoring</h1>
        <p className="text-muted-foreground">
          Bring in data from the apps and devices you already use.{" "}
          <a href="/faq" className="underline inline-flex items-center gap-1">
            Learn more <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
      <FitnessConnectionsSection />
      <RpmDevicesSection />
    </div>
  );
}
