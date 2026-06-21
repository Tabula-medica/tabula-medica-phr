import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Heart,
  Droplets,
  Scale,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Download,
} from "lucide-react";
import { MobileBottomNavSpacer } from "@/components/bottom-nav";

interface VitalReading {
  date: string;
  value: number;
  unit: string;
  systolic?: number;
  diastolic?: number;
}

interface VitalSummary {
  type: string;
  label: string;
  icon: typeof Heart;
  currentValue: string;
  unit: string;
  trend: "up" | "down" | "stable";
  trendPercent: number;
  status: "normal" | "warning" | "critical";
  lastReading: string;
  readings: VitalReading[];
  normalRange?: { min: number; max: number };
}

const mockVitalsData: VitalSummary[] = [
  {
    type: "blood_pressure",
    label: "Blood Pressure",
    icon: Heart,
    currentValue: "128/82",
    unit: "mmHg",
    trend: "down",
    trendPercent: 3.2,
    status: "normal",
    lastReading: "Today, 8:30 AM",
    normalRange: { min: 90, max: 120 },
    readings: [
      { date: "Jan 1", value: 135, systolic: 135, diastolic: 88, unit: "mmHg" },
      { date: "Jan 8", value: 132, systolic: 132, diastolic: 85, unit: "mmHg" },
      { date: "Jan 15", value: 130, systolic: 130, diastolic: 84, unit: "mmHg" },
      { date: "Jan 22", value: 128, systolic: 128, diastolic: 82, unit: "mmHg" },
      { date: "Jan 29", value: 126, systolic: 126, diastolic: 80, unit: "mmHg" },
      { date: "Feb 5", value: 128, systolic: 128, diastolic: 82, unit: "mmHg" },
    ],
  },
  {
    type: "glucose",
    label: "Blood Glucose",
    icon: Droplets,
    currentValue: "105",
    unit: "mg/dL",
    trend: "stable",
    trendPercent: 0.5,
    status: "normal",
    lastReading: "Today, 7:00 AM",
    normalRange: { min: 70, max: 100 },
    readings: [
      { date: "Jan 1", value: 112, unit: "mg/dL" },
      { date: "Jan 8", value: 108, unit: "mg/dL" },
      { date: "Jan 15", value: 105, unit: "mg/dL" },
      { date: "Jan 22", value: 102, unit: "mg/dL" },
      { date: "Jan 29", value: 106, unit: "mg/dL" },
      { date: "Feb 5", value: 105, unit: "mg/dL" },
    ],
  },
  {
    type: "weight",
    label: "Weight",
    icon: Scale,
    currentValue: "172",
    unit: "lbs",
    trend: "down",
    trendPercent: 2.1,
    status: "normal",
    lastReading: "Yesterday, 6:45 AM",
    readings: [
      { date: "Jan 1", value: 178, unit: "lbs" },
      { date: "Jan 8", value: 176, unit: "lbs" },
      { date: "Jan 15", value: 175, unit: "lbs" },
      { date: "Jan 22", value: 174, unit: "lbs" },
      { date: "Jan 29", value: 173, unit: "lbs" },
      { date: "Feb 5", value: 172, unit: "lbs" },
    ],
  },
  {
    type: "heart_rate",
    label: "Heart Rate",
    icon: Activity,
    currentValue: "72",
    unit: "bpm",
    trend: "stable",
    trendPercent: 1.2,
    status: "normal",
    lastReading: "Today, 8:30 AM",
    normalRange: { min: 60, max: 100 },
    readings: [
      { date: "Jan 1", value: 75, unit: "bpm" },
      { date: "Jan 8", value: 73, unit: "bpm" },
      { date: "Jan 15", value: 74, unit: "bpm" },
      { date: "Jan 22", value: 71, unit: "bpm" },
      { date: "Jan 29", value: 70, unit: "bpm" },
      { date: "Feb 5", value: 72, unit: "bpm" },
    ],
  },
  {
    type: "temperature",
    label: "Temperature",
    icon: Thermometer,
    currentValue: "98.4",
    unit: "°F",
    trend: "stable",
    trendPercent: 0,
    status: "normal",
    lastReading: "Today, 8:30 AM",
    normalRange: { min: 97, max: 99 },
    readings: [
      { date: "Jan 1", value: 98.6, unit: "°F" },
      { date: "Jan 8", value: 98.4, unit: "°F" },
      { date: "Jan 15", value: 98.5, unit: "°F" },
      { date: "Jan 22", value: 98.3, unit: "°F" },
      { date: "Jan 29", value: 98.4, unit: "°F" },
      { date: "Feb 5", value: 98.4, unit: "°F" },
    ],
  },
];

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4" aria-hidden="true" />;
  if (trend === "down") return <TrendingDown className="w-4 h-4" aria-hidden="true" />;
  return <Minus className="w-4 h-4" aria-hidden="true" />;
}

function StatusBadge({ status }: { status: "normal" | "warning" | "critical" }) {
  const variants = {
    normal: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2, label: "Normal" },
    warning: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: AlertTriangle, label: "Attention" },
    critical: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle, label: "Critical" },
  };
  
  const config = variants[status];
  const Icon = config.icon;
  
  return (
    <Badge className={config.className} data-testid={`status-badge-${status}`}>
      <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}

function VitalCard({ vital, onClick }: { vital: VitalSummary; onClick: () => void }) {
  const Icon = vital.icon;
  const trendColor = vital.trend === "up" ? "text-red-500" : vital.trend === "down" ? "text-green-500" : "text-muted-foreground";
  
  return (
    <Card 
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${vital.label} details. Current value: ${vital.currentValue} ${vital.unit}`}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      data-testid={`vital-card-${vital.type}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg" aria-hidden="true">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{vital.label}</p>
              <p className="text-xs text-muted-foreground">{vital.lastReading}</p>
            </div>
          </div>
          <StatusBadge status={vital.status} />
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold" data-testid={`vital-value-${vital.type}`}>
              {vital.currentValue}
            </p>
            <p className="text-xs text-muted-foreground">{vital.unit}</p>
          </div>
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon trend={vital.trend} />
            <span className="text-sm font-medium">{vital.trendPercent}%</span>
          </div>
        </div>
        
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={vital.readings.slice(-6)}>
              <defs>
                <linearGradient id={`gradient-${vital.type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill={`url(#gradient-${vital.type})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function VitalDetailChart({ vital }: { vital: VitalSummary }) {
  const isBloodPressure = vital.type === "blood_pressure";
  
  return (
    <Card data-testid={`vital-detail-chart-${vital.type}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <vital.icon className="w-5 h-5 text-primary" aria-hidden="true" />
            <CardTitle>{vital.label} Trend</CardTitle>
          </div>
          <Button variant="outline" size="sm" data-testid="button-export-data">
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Export
          </Button>
        </div>
        <CardDescription>Last 6 readings over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64" role="img" aria-label={`Chart showing ${vital.label} trends over time`}>
          <ResponsiveContainer width="100%" height="100%">
            {isBloodPressure ? (
              <LineChart data={vital.readings}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                  domain={[60, 160]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <ReferenceLine y={120} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label="High" />
                <ReferenceLine y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label="Normal" />
                <Line 
                  type="monotone" 
                  dataKey="systolic" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  name="Systolic"
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolic" 
                  stroke="hsl(var(--secondary-foreground))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--secondary-foreground))", strokeWidth: 2 }}
                  name="Diastolic"
                />
              </LineChart>
            ) : (
              <AreaChart data={vital.readings}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                {vital.normalRange && (
                  <>
                    <ReferenceLine y={vital.normalRange.max} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                    <ReferenceLine y={vital.normalRange.min} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  </>
                )}
                <defs>
                  <linearGradient id="vitalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#vitalGradient)"
                  name={vital.label}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HealthDashboard() {
  const [selectedVital, setSelectedVital] = useState<VitalSummary | null>(null);
  const [timeRange, setTimeRange] = useState("6w");
  
  const vitals = mockVitalsData;
  const normalCount = vitals.filter(v => v.status === "normal").length;
  const warningCount = vitals.filter(v => v.status === "warning").length;
  const criticalCount = vitals.filter(v => v.status === "critical").length;

  return (
    <div className="min-h-screen bg-background" data-testid="health-dashboard-page">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="dashboard-title">
              Health Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your vitals and health trends over time
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-time-range" aria-label="Select time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1w">1 Week</SelectItem>
                <SelectItem value="2w">2 Weeks</SelectItem>
                <SelectItem value="6w">6 Weeks</SelectItem>
                <SelectItem value="3m">3 Months</SelectItem>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" data-testid="button-add-reading">
              <Activity className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Reading
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3" role="region" aria-label="Health status summary">
          <Card className="bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{normalCount}</p>
                <p className="text-sm text-green-600 dark:text-green-500">Normal Vitals</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{warningCount}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">Need Attention</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{criticalCount}</p>
                <p className="text-sm text-red-600 dark:text-red-500">Critical</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList aria-label="Dashboard views">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div 
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              role="region"
              aria-label="Vital signs overview"
            >
              {vitals.map((vital) => (
                <VitalCard 
                  key={vital.type} 
                  vital={vital} 
                  onClick={() => setSelectedVital(vital)}
                />
              ))}
            </div>
            
            {selectedVital && (
              <VitalDetailChart vital={selectedVital} />
            )}
          </TabsContent>
          
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Vitals Comparison</CardTitle>
                <CardDescription>Compare trends across all your health metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80" role="img" aria-label="Combined vitals trend chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Jan", bp: 135, glucose: 112, weight: 178, hr: 75 },
                      { name: "Feb", bp: 132, glucose: 108, weight: 176, hr: 73 },
                      { name: "Mar", bp: 130, glucose: 105, weight: 175, hr: 74 },
                      { name: "Apr", bp: 128, glucose: 102, weight: 174, hr: 71 },
                      { name: "May", bp: 126, glucose: 106, weight: 173, hr: 70 },
                      { name: "Jun", bp: 128, glucose: 105, weight: 172, hr: 72 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                      <YAxis className="text-xs fill-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Bar dataKey="bp" name="Blood Pressure" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="glucose" name="Glucose" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="hr" name="Heart Rate" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reading History</CardTitle>
                <CardDescription>Complete log of all vital readings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vitals.flatMap(v => 
                    v.readings.map((r, i) => ({
                      ...r,
                      type: v.type,
                      label: v.label,
                      icon: v.icon,
                      key: `${v.type}-${i}`
                    }))
                  ).slice(0, 10).map((reading) => {
                    const Icon = reading.icon;
                    return (
                      <div 
                        key={reading.key}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                          <div>
                            <p className="font-medium text-sm">{reading.label}</p>
                            <p className="text-xs text-muted-foreground">{reading.date}</p>
                          </div>
                        </div>
                        <p className="font-semibold">
                          {reading.systolic ? `${reading.systolic}/${reading.diastolic}` : reading.value} {reading.unit}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-dashboard-disclaimer" />
      </div>

      <MobileBottomNavSpacer />
    </div>
  );
}
