import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  Heart,
  Thermometer,
  Scale,
  Droplets,
  Wind,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bluetooth,
  Wifi,
  Battery,
  BatteryLow,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  BellOff,
  Play,
  Square,
  BarChart3,
  Clock,
  Zap,
  Info,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IoTSensor {
  id: string;
  patientId: string;
  type: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  status: "connected" | "disconnected" | "syncing" | "low_battery" | "error";
  batteryLevel: number;
  lastSync: string;
  lastReading: string | null;
  connectionProtocol: "bluetooth" | "wifi" | "cellular" | "zigbee";
  calibrationDate: string;
  nextCalibrationDue: string;
}

interface SensorReading {
  id: string;
  sensorId: string;
  patientId: string;
  sensorType: string;
  timestamp: string;
  values: Record<string, number>;
  unit: string;
  quality: string;
  isAnomalous: boolean;
  anomalyScore?: number;
  anomalyReason?: string;
  context?: {
    activity?: string;
    mealStatus?: string;
    medication?: string;
    notes?: string;
  };
}

interface SensorAlert {
  id: string;
  patientId: string;
  sensorId: string;
  sensorType: string;
  readingId: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "acknowledged" | "resolved" | "escalated";
  title: string;
  message: string;
  recommendedAction: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  escalatedTo?: string;
  aiAnalysis?: string;
  noCdsDisclaimer: string;
}

interface DashboardData {
  sensors: IoTSensor[];
  recentReadings: SensorReading[];
  activeAlerts: SensorAlert[];
  streamingStatus: { sensorId: string; isStreaming: boolean }[];
  summary: {
    totalSensors: number;
    connectedSensors: number;
    lowBatterySensors: number;
    readingsToday: number;
    alertsToday: number;
    criticalAlerts: number;
  };
  noCdsDisclaimer: string;
}

interface TrendAnalysis {
  sensorType: string;
  period: string;
  dataPoints: number;
  trend: "improving" | "stable" | "declining" | "volatile";
  average: number;
  min: number;
  max: number;
  standardDeviation: number;
  anomalyCount: number;
  percentInRange: number;
  aiInsights: string;
  recommendations: string[];
  forecast?: {
    nextDay: number;
    confidence: number;
  };
  noCdsDisclaimer: string;
}

const sensorTypeIcons: Record<string, typeof Heart> = {
  blood_pressure: Heart,
  glucose_meter: Droplets,
  pulse_oximeter: Wind,
  weight_scale: Scale,
  thermometer: Thermometer,
  heart_rate_monitor: Activity,
  ecg_monitor: Activity,
  sleep_tracker: Clock
};

const sensorTypeNames: Record<string, string> = {
  blood_pressure: "Blood Pressure",
  glucose_meter: "Glucose Monitor",
  pulse_oximeter: "Pulse Oximeter",
  weight_scale: "Smart Scale",
  thermometer: "Thermometer",
  heart_rate_monitor: "Heart Rate",
  ecg_monitor: "ECG Monitor",
  sleep_tracker: "Sleep Tracker"
};

const statusColors: Record<string, string> = {
  connected: "bg-green-500",
  disconnected: "bg-gray-500",
  syncing: "bg-blue-500",
  low_battery: "bg-yellow-500",
  error: "bg-red-500"
};

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

export default function IoTHealthSensors() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedSensorType, setSelectedSensorType] = useState<string>("blood_pressure");
  const [trendDays, setTrendDays] = useState(30);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/iot-sensors/dashboard"]
  });

  const { data: readings, isLoading: readingsLoading } = useQuery<{ readings: SensorReading[] }>({
    queryKey: ["/api/iot-sensors/readings", { limit: 100 }]
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery<{ alerts: SensorAlert[] }>({
    queryKey: ["/api/iot-sensors/alerts"]
  });

  const { data: trendAnalysis, isLoading: trendLoading } = useQuery<TrendAnalysis>({
    queryKey: ["/api/iot-sensors/analytics/trends", selectedSensorType, trendDays],
    queryFn: async () => {
      const response = await fetch(`/api/iot-sensors/analytics/trends?sensorType=${selectedSensorType}&days=${trendDays}`);
      return response.json();
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (sensorId: string) => {
      return apiRequest("POST", `/api/iot-sensors/sensors/${sensorId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iot-sensors/dashboard"] });
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/iot-sensors/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      refetchAlerts();
      refetchDashboard();
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/iot-sensors/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      refetchAlerts();
      refetchDashboard();
    }
  });

  const formatValue = (type: string, values: Record<string, number>): string => {
    switch (type) {
      case "blood_pressure":
        return `${values.systolic}/${values.diastolic} mmHg`;
      case "glucose_meter":
        return `${values.glucose} mg/dL`;
      case "pulse_oximeter":
        return `${values.spO2}% SpO2`;
      case "weight_scale":
        return `${values.weight?.toFixed(1)} lbs`;
      case "thermometer":
        return `${values.temperature?.toFixed(1)}°F`;
      default:
        return JSON.stringify(values);
    }
  };

  const getReadingsChartData = (sensorType: string) => {
    if (!readings?.readings) return [];
    
    const filtered = readings.readings
      .filter(r => r.sensorType === sensorType)
      .slice(0, 50)
      .reverse();
    
    return filtered.map(r => ({
      time: new Date(r.timestamp).toLocaleString("en-US", { 
        month: "short", 
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      ...r.values,
      isAnomalous: r.isAnomalous
    }));
  };

  const renderSensorCard = (sensor: IoTSensor) => {
    const Icon = sensorTypeIcons[sensor.type] || Activity;
    const isStreaming = dashboard?.streamingStatus?.find(s => s.sensorId === sensor.id)?.isStreaming;
    
    return (
      <Card key={sensor.id} className="hover-elevate" data-testid={`sensor-card-${sensor.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${sensor.status === "connected" ? "bg-green-100 dark:bg-green-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                <Icon className={`h-5 w-5 ${sensor.status === "connected" ? "text-green-600 dark:text-green-400" : "text-gray-500"}`} />
              </div>
              <div>
                <CardTitle className="text-base">{sensor.name}</CardTitle>
                <CardDescription>{sensor.manufacturer} {sensor.model}</CardDescription>
              </div>
            </div>
            <Badge className={statusColors[sensor.status]} data-testid={`badge-status-${sensor.id}`}>
              {sensor.status.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Connection</span>
              <div className="flex items-center gap-1">
                {sensor.connectionProtocol === "bluetooth" ? <Bluetooth className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                <span className="capitalize">{sensor.connectionProtocol}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Battery</span>
              <div className="flex items-center gap-2">
                {sensor.batteryLevel < 20 ? (
                  <BatteryLow className="h-4 w-4 text-red-500" />
                ) : (
                  <Battery className="h-4 w-4 text-green-500" />
                )}
                <span>{sensor.batteryLevel}%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Sync</span>
              <span>{new Date(sensor.lastSync).toLocaleTimeString()}</span>
            </div>
            
            {isStreaming && (
              <Badge variant="outline" className="w-full justify-center">
                <Zap className="h-3 w-3 mr-1 animate-pulse" />
                Streaming Live Data
              </Badge>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => syncMutation.mutate(sensor.id)}
                disabled={syncMutation.isPending}
                data-testid={`sync-sensor-${sensor.id}`}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAlertCard = (alert: SensorAlert) => {
    const Icon = alert.severity === "critical" ? AlertCircle : AlertTriangle;
    const severityBg = alert.severity === "critical" ? "bg-red-50 dark:bg-red-950" : alert.severity === "high" ? "bg-orange-50 dark:bg-orange-950" : "bg-yellow-50 dark:bg-yellow-950";
    
    return (
      <Card key={alert.id} className={severityBg} data-testid={`alert-card-${alert.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className={`p-1.5 rounded-full ${alert.severity === "critical" ? "bg-red-100 dark:bg-red-900" : alert.severity === "high" ? "bg-orange-100 dark:bg-orange-900" : "bg-yellow-100 dark:bg-yellow-900"}`}>
                <Icon className={`h-4 w-4 ${alert.severity === "critical" ? "text-red-600 dark:text-red-400" : alert.severity === "high" ? "text-orange-600 dark:text-orange-400" : "text-yellow-600 dark:text-yellow-400"}`} />
              </div>
              <div>
                <CardTitle className="text-base">{alert.title}</CardTitle>
                <CardDescription>
                  {sensorTypeNames[alert.sensorType]} - {new Date(alert.createdAt).toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <Badge className={severityColors[alert.severity]} data-testid={`badge-severity-${alert.id}`}>
              {alert.severity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3">{alert.message}</p>
          
          {alert.aiAnalysis && (
            <div className="bg-muted/50 p-3 rounded-lg mb-3">
              <p className="text-sm font-medium mb-1">AI Analysis</p>
              <p className="text-sm text-muted-foreground">{alert.aiAnalysis}</p>
            </div>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg mb-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Recommended Action</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">{alert.recommendedAction}</p>
          </div>
          
          <Alert variant="default" className="mb-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {alert.noCdsDisclaimer}
            </AlertDescription>
          </Alert>
          
          {alert.status === "active" && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => acknowledgeMutation.mutate(alert.id)}
                disabled={acknowledgeMutation.isPending}
                data-testid={`acknowledge-alert-${alert.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Acknowledge
              </Button>
              <Button 
                size="sm"
                onClick={() => resolveMutation.mutate(alert.id)}
                disabled={resolveMutation.isPending}
                data-testid={`resolve-alert-${alert.id}`}
              >
                <BellOff className="h-4 w-4 mr-1" />
                Resolve
              </Button>
            </div>
          )}
          
          {alert.status === "acknowledged" && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Acknowledged at {new Date(alert.acknowledgedAt!).toLocaleString()}
              </span>
              <Button 
                size="sm"
                onClick={() => resolveMutation.mutate(alert.id)}
                disabled={resolveMutation.isPending}
                data-testid={`resolve-alert-${alert.id}`}
              >
                <BellOff className="h-4 w-4 mr-1" />
                Resolve
              </Button>
            </div>
          )}
          
          {alert.status === "resolved" && (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Resolved
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">IoT Health Sensors</h1>
            <p className="text-muted-foreground">Real-time monitoring of your connected health devices</p>
          </div>
          <Button onClick={() => refetchDashboard()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card data-testid="stat-total-sensors">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard?.summary.totalSensors || 0}</div>
              <p className="text-sm text-muted-foreground">Total Sensors</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-connected-sensors">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{dashboard?.summary.connectedSensors || 0}</div>
              <p className="text-sm text-muted-foreground">Connected</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-readings-today">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dashboard?.summary.readingsToday || 0}</div>
              <p className="text-sm text-muted-foreground">Readings Today</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-alerts-today">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{dashboard?.summary.alertsToday || 0}</div>
              <p className="text-sm text-muted-foreground">Alerts Today</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-critical-alerts">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{dashboard?.summary.criticalAlerts || 0}</div>
              <p className="text-sm text-muted-foreground">Critical Alerts</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-low-battery">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{dashboard?.summary.lowBatterySensors || 0}</div>
              <p className="text-sm text-muted-foreground">Low Battery</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="flex-wrap" data-testid="tabs-main">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sensors" data-testid="tab-sensors">Sensors</TabsTrigger>
            <TabsTrigger value="readings" data-testid="tab-readings">Readings</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              Alerts
              {(dashboard?.activeAlerts?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">{dashboard?.activeAlerts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {dashboard?.activeAlerts && dashboard.activeAlerts.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Active Alerts</AlertTitle>
                <AlertDescription>
                  You have {dashboard.activeAlerts.length} active alert(s) requiring attention.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Blood Pressure</CardTitle>
                  <CardDescription>Last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getReadingsChartData("blood_pressure")}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis domain={[60, 180]} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="5 5" label="High" />
                        <ReferenceLine y={90} stroke="#3b82f6" strokeDasharray="5 5" label="Low" />
                        <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" name="Diastolic" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Blood Glucose</CardTitle>
                  <CardDescription>Continuous monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getReadingsChartData("glucose_meter")}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis domain={[50, 200]} />
                        <Tooltip />
                        <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="5 5" label="High" />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 5" label="Low" />
                        <Area type="monotone" dataKey="glucose" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Glucose (mg/dL)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Connected Devices</CardTitle>
                <CardDescription>Your health monitoring sensors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboard?.sensors.slice(0, 6).map(renderSensorCard)}
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {dashboard?.noCdsDisclaimer}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="sensors" className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard?.sensors.map(renderSensorCard)}
            </div>
          </TabsContent>

          <TabsContent value="readings" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle>Recent Readings</CardTitle>
                    <CardDescription>All sensor data from your devices</CardDescription>
                  </div>
                  <Select value={selectedSensorType} onValueChange={setSelectedSensorType}>
                    <SelectTrigger className="w-48" data-testid="select-sensor-type">
                      <SelectValue placeholder="Select sensor type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                      <SelectItem value="glucose_meter">Glucose Monitor</SelectItem>
                      <SelectItem value="pulse_oximeter">Pulse Oximeter</SelectItem>
                      <SelectItem value="weight_scale">Weight Scale</SelectItem>
                      <SelectItem value="thermometer">Thermometer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedSensorType === "blood_pressure" ? (
                      <LineChart data={getReadingsChartData(selectedSensorType)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis domain={[50, 180]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} />
                        <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" name="Diastolic" strokeWidth={2} />
                        <Line type="monotone" dataKey="pulse" stroke="#10b981" name="Pulse" strokeWidth={2} />
                      </LineChart>
                    ) : selectedSensorType === "glucose_meter" ? (
                      <AreaChart data={getReadingsChartData(selectedSensorType)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis domain={[50, 250]} />
                        <Tooltip />
                        <Area type="monotone" dataKey="glucose" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Glucose" />
                      </AreaChart>
                    ) : selectedSensorType === "pulse_oximeter" ? (
                      <LineChart data={getReadingsChartData(selectedSensorType)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis domain={[85, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="spO2" stroke="#06b6d4" name="SpO2 %" strokeWidth={2} />
                        <Line type="monotone" dataKey="pulseRate" stroke="#f97316" name="Pulse Rate" strokeWidth={2} />
                      </LineChart>
                    ) : (
                      <LineChart data={getReadingsChartData(selectedSensorType)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey={Object.keys(getReadingsChartData(selectedSensorType)[0] || {})[1] || "value"} stroke="#8b5cf6" strokeWidth={2} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 space-y-2">
                  <h4 className="font-medium">Recent Readings</h4>
                  <div className="divide-y">
                    {readings?.readings
                      ?.filter(r => r.sensorType === selectedSensorType)
                      .slice(0, 10)
                      .map(reading => (
                        <div key={reading.id} className="py-3 flex items-center justify-between" data-testid={`reading-row-${reading.id}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${reading.isAnomalous ? "bg-red-500" : "bg-green-500"}`} />
                            <div>
                              <p className="font-medium">{formatValue(reading.sensorType, reading.values)}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(reading.timestamp).toLocaleString()}
                                {reading.context?.mealStatus && ` - ${reading.context.mealStatus.replace("_", " ")}`}
                              </p>
                            </div>
                          </div>
                          {reading.isAnomalous && (
                            <Badge variant="destructive">Anomaly</Badge>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <div className="flex gap-4 flex-wrap">
              <Badge variant="outline" className="bg-red-50 dark:bg-red-950">
                Critical: {alerts?.alerts?.filter(a => a.severity === "critical" && a.status === "active").length || 0}
              </Badge>
              <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">
                High: {alerts?.alerts?.filter(a => a.severity === "high" && a.status === "active").length || 0}
              </Badge>
              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                Medium: {alerts?.alerts?.filter(a => a.severity === "medium" && a.status === "active").length || 0}
              </Badge>
            </div>

            <div className="space-y-4">
              {alerts?.alerts?.map(renderAlertCard)}
              
              {(!alerts?.alerts || alerts.alerts.length === 0) && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-medium text-lg">No Alerts</h3>
                    <p className="text-muted-foreground">All your readings are within normal ranges</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={selectedSensorType} onValueChange={setSelectedSensorType}>
                <SelectTrigger className="w-48" data-testid="select-analytics-sensor">
                  <SelectValue placeholder="Select sensor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                  <SelectItem value="glucose_meter">Glucose Monitor</SelectItem>
                  <SelectItem value="pulse_oximeter">Pulse Oximeter</SelectItem>
                  <SelectItem value="weight_scale">Weight Scale</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={String(trendDays)} onValueChange={(v) => setTrendDays(parseInt(v))}>
                <SelectTrigger className="w-32" data-testid="select-trend-days">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trendLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : trendAnalysis ? (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Trend Analysis
                      {trendAnalysis.trend === "improving" && <TrendingUp className="h-5 w-5 text-green-500" />}
                      {trendAnalysis.trend === "declining" && <TrendingDown className="h-5 w-5 text-red-500" />}
                      {trendAnalysis.trend === "stable" && <Minus className="h-5 w-5 text-blue-500" />}
                      {trendAnalysis.trend === "volatile" && <Activity className="h-5 w-5 text-yellow-500" />}
                    </CardTitle>
                    <CardDescription>{trendAnalysis.period} analysis with {trendAnalysis.dataPoints} data points</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">Average</p>
                          <p className="text-xl font-bold">{trendAnalysis.average}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">Range</p>
                          <p className="text-xl font-bold">{trendAnalysis.min} - {trendAnalysis.max}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">In Normal Range</p>
                          <p className="text-xl font-bold">{trendAnalysis.percentInRange}%</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">Anomalies</p>
                          <p className="text-xl font-bold text-red-600">{trendAnalysis.anomalyCount}</p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <p className="text-sm font-medium mb-1">Trend</p>
                        <Badge className={
                          trendAnalysis.trend === "improving" ? "bg-green-100 text-green-800" :
                          trendAnalysis.trend === "declining" ? "bg-red-100 text-red-800" :
                          trendAnalysis.trend === "volatile" ? "bg-yellow-100 text-yellow-800" :
                          "bg-blue-100 text-blue-800"
                        }>
                          {trendAnalysis.trend.charAt(0).toUpperCase() + trendAnalysis.trend.slice(1)}
                        </Badge>
                      </div>

                      {trendAnalysis.forecast && (
                        <div className="pt-4">
                          <p className="text-sm font-medium mb-1">Forecast (Next Day)</p>
                          <p className="text-lg">{trendAnalysis.forecast.nextDay} <span className="text-sm text-muted-foreground">({Math.round(trendAnalysis.forecast.confidence * 100)}% confidence)</span></p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>AI Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm">{trendAnalysis.aiInsights}</p>
                      
                      {trendAnalysis.recommendations.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Recommendations</p>
                          <ul className="space-y-2">
                            {trendAnalysis.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {trendAnalysis.noCdsDisclaimer}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
