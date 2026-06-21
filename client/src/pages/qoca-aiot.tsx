import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  BatteryWarning,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Smartphone,
  Shield,
  Stethoscope,
  Bell,
  BellRing,
  Sparkles,
  MonitorSmartphone,
  Pill,
  Moon,
  Footprints,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";

const DEVICE_TYPE_ICONS: Record<string, typeof Activity> = {
  ecg_monitor: Heart,
  digital_stethoscope: Stethoscope,
  vital_signs_hub: Activity,
  smart_patient_terminal: MonitorSmartphone,
  environmental_sensor: Wind,
  fall_detector: Footprints,
  medication_dispenser: Pill,
  sleep_monitor: Moon,
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  ecg_monitor: "ECG Monitor",
  digital_stethoscope: "Digital Stethoscope",
  vital_signs_hub: "Vital Signs Hub",
  smart_patient_terminal: "Smart Patient Terminal",
  environmental_sensor: "Environmental Sensor",
  fall_detector: "Fall Detector",
  medication_dispenser: "Medication Dispenser",
  sleep_monitor: "Sleep Monitor",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const REGION_LABELS: Record<string, string> = {
  asia_pacific: "Asia Pacific",
  europe: "Europe",
  north_america: "North America",
  south_america: "South America",
  middle_east: "Middle East",
  africa: "Africa",
};

const LOCALE_FLAGS: Record<string, string> = {
  en: "🇺🇸", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇧🇷",
  zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", ar: "🇸🇦", hi: "🇮🇳", th: "🇹🇭",
  vi: "🇻🇳", id: "🇮🇩", ms: "🇲🇾", tl: "🇵🇭", ru: "🇷🇺", tr: "🇹🇷", nl: "🇳🇱",
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function BatteryIndicator({ level }: { level: number }) {
  const Icon = level > 50 ? Battery : level > 20 ? BatteryWarning : BatteryLow;
  const color = level > 50 ? "text-green-500" : level > 20 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="flex items-center gap-1" data-testid="battery-indicator">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>{level}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    offline: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    syncing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    low_battery: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    maintenance: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    pairing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  };
  return (
    <Badge className={`${colors[status] || colors.offline} text-xs`} data-testid={`status-${status}`}>
      {status === "online" && <Wifi className="h-3 w-3 mr-1" />}
      {status === "offline" && <WifiOff className="h-3 w-3 mr-1" />}
      {status.replace("_", " ")}
    </Badge>
  );
}

export default function QocaAIoTPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashLoading } = useQuery<any>({
    queryKey: ["/api/qoca-aiot/dashboard"],
  });

  const { data: devices, isLoading: devicesLoading } = useQuery<any[]>({
    queryKey: ["/api/qoca-aiot/devices"],
  });

  const { data: alerts } = useQuery<any[]>({
    queryKey: ["/api/qoca-aiot/alerts"],
  });

  const { data: readings } = useQuery<any[]>({
    queryKey: ["/api/qoca-aiot/readings"],
  });

  const { data: careEvents } = useQuery<any[]>({
    queryKey: ["/api/qoca-aiot/care-events"],
  });

  const { data: aiInsight, isLoading: insightLoading } = useQuery<any>({
    queryKey: ["/api/qoca-aiot/ai-insight"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/qoca-aiot/alerts/${alertId}/acknowledge`, { acknowledgedBy: "Patient" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qoca-aiot/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qoca-aiot/dashboard"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-qoca">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unacknowledgedAlerts = alerts?.filter((a: any) => !a.acknowledged) || [];

  return (
    <div className="space-y-6 p-1" data-testid="page-qoca-aiot">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">QOCA AIoT</h1>
              <p className="text-sm text-muted-foreground">AI-Powered Future Health Monitoring</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1" data-testid="badge-global">
            <Globe className="h-3 w-3" />
            19 Languages
          </Badge>
          <Badge variant="outline" className="gap-1" data-testid="badge-hipaa">
            <Shield className="h-3 w-3" />
            HIPAA Compliant
          </Badge>
          <a href="https://www.qoca.net/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" data-testid="link-qoca-website">
              <ExternalLink className="h-3 w-3 mr-1" />
              QOCA
            </Button>
          </a>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card data-testid="card-total-devices">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Devices</p>
                  <p className="text-2xl font-bold">{dashboard.totalDevices}</p>
                </div>
                <Smartphone className="h-8 w-8 text-teal-500 opacity-50" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-green-600">{dashboard.onlineDevices} online</span>
                <span className="text-xs text-muted-foreground">{dashboard.offlineDevices} offline</span>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-alerts-today">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Alerts Today</p>
                  <p className="text-2xl font-bold">{dashboard.alertsToday}</p>
                </div>
                <BellRing className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
              {dashboard.criticalAlerts > 0 && (
                <p className="text-xs text-red-600 mt-2">{dashboard.criticalAlerts} critical</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-readings-today">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Readings Today</p>
                  <p className="text-2xl font-bold">{dashboard.readingsToday}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Continuous monitoring</p>
            </CardContent>
          </Card>

          <Card data-testid="card-system-health">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">System Health</p>
                  <p className="text-2xl font-bold">{dashboard.systemHealth?.uptime}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.systemHealth?.dataLatency}ms latency
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {aiInsight && (
        <Card className="border-teal-200 dark:border-teal-800 bg-gradient-to-r from-teal-50/50 to-cyan-50/30 dark:from-teal-950/20 dark:to-cyan-950/10" data-testid="card-ai-insight">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-sm font-semibold text-teal-700 dark:text-teal-400">AI Health Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {insightLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Generating insight...</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground/80" data-testid="text-ai-insight">{aiInsight.insight}</p>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/40 px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-tight text-amber-700 dark:text-amber-300">{aiInsight.disclaimer}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">Devices</TabsTrigger>
          <TabsTrigger value="readings" data-testid="tab-readings">Readings</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {unacknowledgedAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="care" data-testid="tab-care">Care</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {dashboard?.regionalCoverage && (
            <Card data-testid="card-regional-coverage">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  International Coverage
                </CardTitle>
                <CardDescription>QOCA AIoT devices deployed worldwide</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(dashboard.regionalCoverage).map(([region, count]) => (
                    <div key={region} className="flex items-center justify-between p-3 rounded-lg border bg-card" data-testid={`region-${region}`}>
                      <span className="text-sm font-medium">{REGION_LABELS[region] || region}</span>
                      <Badge variant="secondary">{count as number} device(s)</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-device-types">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Device Ecosystem
              </CardTitle>
              <CardDescription>QOCA smart health device portfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(DEVICE_TYPE_LABELS).map(([type, label]) => {
                  const Icon = DEVICE_TYPE_ICONS[type] || Activity;
                  const count = dashboard?.devicesByType?.[type] || 0;
                  return (
                    <div key={type} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors" data-testid={`device-type-${type}`}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                        <Icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <span className="text-xs font-medium text-center">{label}</span>
                      {count > 0 && <Badge variant="secondary" className="text-xs">{count} active</Badge>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-locale-support">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Language Support
              </CardTitle>
              <CardDescription>QOCA platform available in 19 languages for worldwide patients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LOCALE_FLAGS).map(([code, flag]) => (
                  <Badge key={code} variant="outline" className="text-sm gap-1 px-3 py-1" data-testid={`locale-${code}`}>
                    <span>{flag}</span>
                    <span className="uppercase">{code}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-3 mt-4">
          {devicesLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : devices && devices.length > 0 ? (
            devices.map((device: any) => {
              const Icon = DEVICE_TYPE_ICONS[device.type] || Activity;
              return (
                <Card key={device.id} className="hover:shadow-md transition-shadow" data-testid={`device-card-${device.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 flex-shrink-0">
                          <Icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm" data-testid={`text-device-name-${device.id}`}>{device.name}</h3>
                          <p className="text-xs text-muted-foreground">{device.model} / {device.serialNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={device.status} />
                            <BatteryIndicator level={device.batteryLevel} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs gap-1">
                          {LOCALE_FLAGS[device.locale] || ""} {REGION_LABELS[device.region]}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(device.lastSync)}
                        </span>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Protocol</span>
                        <p className="font-medium">{device.connectionProtocol.replace("_", " ")}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Firmware</span>
                        <p className="font-medium">v{device.firmwareVersion}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Warranty</span>
                        <p className="font-medium">{new Date(device.warrantyExpiry) > new Date() ? "Active" : "Expired"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-medium">No QOCA devices connected</p>
                <p className="text-sm text-muted-foreground mt-1">Pair a QOCA device to start monitoring</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="readings" className="space-y-3 mt-4">
          {readings && readings.length > 0 ? (
            readings.slice(0, 20).map((reading: any) => {
              const Icon = DEVICE_TYPE_ICONS[reading.deviceType] || Activity;
              return (
                <Card key={reading.id} className={reading.isAnomalous ? "border-red-300 dark:border-red-800" : ""} data-testid={`reading-card-${reading.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-teal-600" />
                        <span className="text-sm font-medium">{DEVICE_TYPE_LABELS[reading.deviceType]}</span>
                        {reading.isAnomalous && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Anomaly
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(reading.timestamp)}</span>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {Object.entries(reading.values).map(([key, val]) => (
                        <div key={key} className="rounded-lg bg-muted/50 p-2 text-center">
                          <span className="text-[10px] text-muted-foreground block">{key}</span>
                          <span className="text-sm font-semibold">{typeof val === "number" ? (Number.isInteger(val) ? val : (val as number).toFixed(1)) : val}</span>
                        </div>
                      ))}
                    </div>
                    {reading.anomalyDetail && (
                      <p className="text-xs text-red-600 mt-2">{reading.anomalyDetail}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-medium">No readings yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-3 mt-4">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert: any) => (
              <Card key={alert.id} className={!alert.acknowledged ? "border-l-4 border-l-orange-400" : ""} data-testid={`alert-card-${alert.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${
                        alert.priority === "critical" ? "bg-red-100 dark:bg-red-900/30" :
                        alert.priority === "high" ? "bg-orange-100 dark:bg-orange-900/30" :
                        "bg-yellow-100 dark:bg-yellow-900/30"
                      }`}>
                        {alert.priority === "critical" ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Bell className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`text-xs ${PRIORITY_COLORS[alert.priority]}`}>{alert.priority}</Badge>
                          <span className="text-xs text-muted-foreground">{formatTimestamp(alert.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {alert.acknowledged ? (
                        <Badge variant="outline" className="text-xs text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          data-testid={`button-ack-${alert.id}`}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500/30" />
                <p className="font-medium">No alerts</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="care" className="space-y-3 mt-4">
          <Card data-testid="card-care-coordination">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Care Coordination
              </CardTitle>
              <CardDescription>QOCA atm platform events and telehealth sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {careEvents && careEvents.length > 0 ? (
                <div className="space-y-3">
                  {careEvents.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`care-event-${event.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          event.status === "completed" ? "bg-green-500" :
                          event.status === "active" ? "bg-blue-500 animate-pulse" :
                          event.status === "pending" ? "bg-yellow-500" : "bg-gray-400"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{event.eventType.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.participants.join(", ")} {event.locale && `(${LOCALE_FLAGS[event.locale] || event.locale})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={event.status === "completed" ? "secondary" : event.status === "pending" ? "outline" : "default"} className="text-xs">
                          {event.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(event.scheduledAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No care events scheduled</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-qoca-products">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">QOCA Platform Products</CardTitle>
              <CardDescription>Integrated AI healthcare solutions by Quanta Research Institute</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { name: "QOCA abc", desc: "AI IoT for Body Care — Portable ECG monitoring with wearable design for hospital or home use", icon: Heart },
                  { name: "QOCA atm", desc: "AI Platform for Patient Care — Cloud-based telehealth with video consultations", icon: MonitorSmartphone },
                  { name: "QOCA spt", desc: "Smart Patient Terminal — Bedside care with reminders, education, and nurse call", icon: Smartphone },
                  { name: "QOCA acc", desc: "Assisted Care Coordination — Smart whiteboard, mobile nursing, HIS/PACS integration", icon: Stethoscope },
                ].map((product) => (
                  <div key={product.name} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors" data-testid={`product-${product.name.replace(/\s/g, "-")}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 flex-shrink-0">
                      <product.icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/40 px-4 py-3" data-testid="noCDS-disclaimer">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Informational Only — NO Clinical Decision Support</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                All QOCA AIoT readings, alerts, and AI-generated summaries are provided for informational purposes only.
                They do not constitute medical advice, diagnosis, or treatment recommendations. Always consult a qualified healthcare provider.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
