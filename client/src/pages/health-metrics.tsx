import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Activity,
  Weight,
  Thermometer,
  Wind,
  Droplets,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  BarChart3,
  List,
  ArrowLeft,
  Loader2,
  Percent,
  Scale,
  Gauge,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, parseISO } from "date-fns";
import { Link } from "wouter";

interface HealthMetric {
  id: string;
  profileId: string;
  type: MetricType;
  value: number;
  unit: string;
  recordedAt: string;
  source: "manual" | "device" | "extracted";
  notes?: string;
}

type MetricType = 
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic"
  | "heart_rate"
  | "weight"
  | "bmi"
  | "temperature"
  | "spo2"
  | "respiration_rate"
  | "blood_glucose"
  | "height";

interface MetricConfig {
  label: string;
  unit: string;
  icon: typeof Heart;
  color: string;
  normalRange: { min: number; max: number };
  category: "vitals" | "body" | "labs";
}

const metricConfigs: Record<MetricType, MetricConfig> = {
  blood_pressure_systolic: {
    label: "Blood Pressure (Systolic)",
    unit: "mmHg",
    icon: Heart,
    color: "#ef4444",
    normalRange: { min: 90, max: 120 },
    category: "vitals",
  },
  blood_pressure_diastolic: {
    label: "Blood Pressure (Diastolic)",
    unit: "mmHg",
    icon: Heart,
    color: "#f97316",
    normalRange: { min: 60, max: 80 },
    category: "vitals",
  },
  heart_rate: {
    label: "Heart Rate",
    unit: "bpm",
    icon: Activity,
    color: "#ec4899",
    normalRange: { min: 60, max: 100 },
    category: "vitals",
  },
  weight: {
    label: "Weight",
    unit: "lbs",
    icon: Weight,
    color: "#8b5cf6",
    normalRange: { min: 0, max: 999 },
    category: "body",
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    icon: Scale,
    color: "#06b6d4",
    normalRange: { min: 18.5, max: 24.9 },
    category: "body",
  },
  temperature: {
    label: "Temperature",
    unit: "°F",
    icon: Thermometer,
    color: "#f59e0b",
    normalRange: { min: 97.0, max: 99.0 },
    category: "vitals",
  },
  spo2: {
    label: "Blood Oxygen (SpO2)",
    unit: "%",
    icon: Percent,
    color: "#22c55e",
    normalRange: { min: 95, max: 100 },
    category: "vitals",
  },
  respiration_rate: {
    label: "Respiration Rate",
    unit: "breaths/min",
    icon: Wind,
    color: "#3b82f6",
    normalRange: { min: 12, max: 20 },
    category: "vitals",
  },
  blood_glucose: {
    label: "Blood Glucose",
    unit: "mg/dL",
    icon: Droplets,
    color: "#a855f7",
    normalRange: { min: 70, max: 100 },
    category: "labs",
  },
  height: {
    label: "Height",
    unit: "in",
    icon: Gauge,
    color: "#64748b",
    normalRange: { min: 0, max: 999 },
    category: "body",
  },
};

const generateSampleHistory = (type: MetricType): HealthMetric[] => {
  const config = metricConfigs[type];
  const { min, max } = config.normalRange;
  const range = max - min;
  const baseValue = min + range * 0.5;
  
  return Array.from({ length: 30 }, (_, i) => ({
    id: `${type}-${i}`,
    profileId: "profile-1",
    type,
    value: parseFloat((baseValue + (Math.random() - 0.5) * range * 0.4).toFixed(1)),
    unit: config.unit,
    recordedAt: subDays(new Date(), 29 - i).toISOString(),
    source: Math.random() > 0.7 ? "manual" : "extracted",
  }));
};

const sampleCurrentMetrics: Record<MetricType, HealthMetric> = {
  blood_pressure_systolic: {
    id: "bp-sys-1",
    profileId: "profile-1",
    type: "blood_pressure_systolic",
    value: 128,
    unit: "mmHg",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
  blood_pressure_diastolic: {
    id: "bp-dia-1",
    profileId: "profile-1",
    type: "blood_pressure_diastolic",
    value: 78,
    unit: "mmHg",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
  heart_rate: {
    id: "hr-1",
    profileId: "profile-1",
    type: "heart_rate",
    value: 72,
    unit: "bpm",
    recordedAt: new Date().toISOString(),
    source: "device",
  },
  weight: {
    id: "weight-1",
    profileId: "profile-1",
    type: "weight",
    value: 168,
    unit: "lbs",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
  bmi: {
    id: "bmi-1",
    profileId: "profile-1",
    type: "bmi",
    value: 24.2,
    unit: "kg/m²",
    recordedAt: new Date().toISOString(),
    source: "extracted",
  },
  temperature: {
    id: "temp-1",
    profileId: "profile-1",
    type: "temperature",
    value: 98.6,
    unit: "°F",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
  spo2: {
    id: "spo2-1",
    profileId: "profile-1",
    type: "spo2",
    value: 98,
    unit: "%",
    recordedAt: new Date().toISOString(),
    source: "device",
  },
  respiration_rate: {
    id: "rr-1",
    profileId: "profile-1",
    type: "respiration_rate",
    value: 16,
    unit: "breaths/min",
    recordedAt: new Date().toISOString(),
    source: "extracted",
  },
  blood_glucose: {
    id: "bg-1",
    profileId: "profile-1",
    type: "blood_glucose",
    value: 95,
    unit: "mg/dL",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
  height: {
    id: "height-1",
    profileId: "profile-1",
    type: "height",
    value: 70,
    unit: "in",
    recordedAt: new Date().toISOString(),
    source: "manual",
  },
};

function isInNormalRange(type: MetricType, value: number): boolean {
  const config = metricConfigs[type];
  return value >= config.normalRange.min && value <= config.normalRange.max;
}

function getTrend(history: HealthMetric[]): "up" | "down" | "stable" {
  if (history.length < 2) return "stable";
  const recent = history.slice(-3);
  const older = history.slice(-6, -3);
  if (recent.length === 0 || older.length === 0) return "stable";
  
  const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
  const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;
  const diff = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (diff > 5) return "up";
  if (diff < -5) return "down";
  return "stable";
}

function MetricCard({ 
  type, 
  current, 
  history,
  onViewDetails 
}: { 
  type: MetricType; 
  current: HealthMetric;
  history: HealthMetric[];
  onViewDetails: () => void;
}) {
  const config = metricConfigs[type];
  const Icon = config.icon;
  const isNormal = isInNormalRange(type, current.value);
  const trend = getTrend(history);
  
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  
  const chartData = history.slice(-7).map(m => ({
    date: format(parseISO(m.recordedAt), "MM/dd"),
    value: m.value,
  }));

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`card-metric-${type}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-md" 
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <div>
              <p className="text-sm font-medium">{config.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{current.value}</span>
                <span className="text-sm text-muted-foreground">{config.unit}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={isNormal ? "outline" : "destructive"} className="text-xs">
              {isNormal ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {isNormal ? "Normal" : "Attention"}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendIcon className="h-3 w-3" />
              <span>{trend}</span>
            </div>
          </div>
        </div>
        
        {chartData.length > 1 && (
          <div className="mt-3 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={config.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  fill={`url(#gradient-${type})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground mt-2">
          Last updated: {format(parseISO(current.recordedAt), "MMM d, h:mm a")}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricDetailView({
  type,
  history,
  onClose,
}: {
  type: MetricType;
  history: HealthMetric[];
  onClose: () => void;
}) {
  const config = metricConfigs[type];
  const Icon = config.icon;
  
  const chartData = history.map(m => ({
    date: format(parseISO(m.recordedAt), "MM/dd"),
    fullDate: format(parseISO(m.recordedAt), "MMM d, yyyy"),
    value: m.value,
    normalMin: config.normalRange.min,
    normalMax: config.normalRange.max,
  }));
  
  const stats = {
    min: Math.min(...history.map(m => m.value)),
    max: Math.max(...history.map(m => m.value)),
    avg: (history.reduce((sum, m) => sum + m.value, 0) / history.length).toFixed(1),
    latest: history[history.length - 1]?.value || 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div 
            className="p-2 rounded-md" 
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="h-5 w-5" style={{ color: config.color }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{config.label}</h2>
            <p className="text-sm text-muted-foreground">30-day history</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Latest</p>
            <p className="text-xl font-bold">{stats.latest}</p>
            <p className="text-xs text-muted-foreground">{config.unit}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-xl font-bold">{stats.avg}</p>
            <p className="text-xs text-muted-foreground">{config.unit}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Min</p>
            <p className="text-xl font-bold">{stats.min}</p>
            <p className="text-xs text-muted-foreground">{config.unit}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-xl font-bold">{stats.max}</p>
            <p className="text-xs text-muted-foreground">{config.unit}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trend Over Time</CardTitle>
          <CardDescription>
            Normal range: {config.normalRange.min} - {config.normalRange.max} {config.unit}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ''}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ fill: config.color, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: config.color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <List className="h-4 w-4" />
            Recent Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {[...history].reverse().slice(0, 10).map((metric) => (
                <div 
                  key={metric.id} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{metric.value}</span>
                      <span className="text-muted-foreground ml-1">{config.unit}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {metric.source}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(metric.recordedAt), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function LogMetricDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MetricType>("heart_rate");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value) {
      toast({
        title: "Value required",
        description: "Please enter a value for the metric.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await apiRequest("POST", "/api/health-metrics", {
        type: selectedType,
        value: parseFloat(value),
        notes: notes || undefined,
        recordedAt: new Date().toISOString(),
        source: "manual",
      });
      
      toast({
        title: "Metric logged",
        description: `${metricConfigs[selectedType].label} has been recorded.`,
      });
      
      setOpen(false);
      setValue("");
      setNotes("");
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log metric. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = metricConfigs[selectedType];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-metric">
          <Plus className="h-4 w-4 mr-2" />
          Log Metric
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Health Metric</DialogTitle>
          <DialogDescription>
            Manually record a health reading. This will be added to your health history.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="metric-type">Metric Type</Label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as MetricType)}>
              <SelectTrigger data-testid="select-metric-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blood_pressure_systolic">Blood Pressure (Systolic)</SelectItem>
                <SelectItem value="blood_pressure_diastolic">Blood Pressure (Diastolic)</SelectItem>
                <SelectItem value="heart_rate">Heart Rate</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="bmi">BMI</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="spo2">Blood Oxygen (SpO2)</SelectItem>
                <SelectItem value="respiration_rate">Respiration Rate</SelectItem>
                <SelectItem value="blood_glucose">Blood Glucose</SelectItem>
                <SelectItem value="height">Height</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="value">Value ({config.unit})</Label>
            <Input
              id="value"
              type="number"
              step="0.1"
              placeholder={`Enter ${config.label.toLowerCase()}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="input-metric-value"
            />
            <p className="text-xs text-muted-foreground">
              Normal range: {config.normalRange.min} - {config.normalRange.max} {config.unit}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., After exercise, fasting reading"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-metric-notes"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-submit-metric">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Log Reading
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HealthMetricsPage() {
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "vitals" | "body" | "labs">("all");

  const { data: metricsData, isLoading, refetch } = useQuery<{ metrics: HealthMetric[] }>({
    queryKey: ["/api/health-metrics"],
  });

  const currentMetrics = sampleCurrentMetrics;
  const metricHistories: Record<MetricType, HealthMetric[]> = {} as any;
  
  for (const type of Object.keys(metricConfigs) as MetricType[]) {
    metricHistories[type] = generateSampleHistory(type);
  }

  const filteredTypes = (Object.keys(metricConfigs) as MetricType[]).filter(type => {
    if (categoryFilter === "all") return true;
    return metricConfigs[type].category === categoryFilter;
  });

  if (selectedMetric) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <MetricDetailView
          type={selectedMetric}
          history={metricHistories[selectedMetric]}
          onClose={() => setSelectedMetric(null)}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/patient-home">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Health Metrics</h1>
            <p className="text-muted-foreground">Track and visualize your vital signs over time</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <LogMetricDialog onSuccess={() => refetch()} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
          data-testid="button-filter-all"
        >
          All
        </Button>
        <Button
          variant={categoryFilter === "vitals" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("vitals")}
          data-testid="button-filter-vitals"
        >
          <Heart className="h-3 w-3 mr-1" />
          Vitals
        </Button>
        <Button
          variant={categoryFilter === "body" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("body")}
          data-testid="button-filter-body"
        >
          <Weight className="h-3 w-3 mr-1" />
          Body
        </Button>
        <Button
          variant={categoryFilter === "labs" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("labs")}
          data-testid="button-filter-labs"
        >
          <Droplets className="h-3 w-3 mr-1" />
          Labs
        </Button>
        
        <div className="flex-1" />
        
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTypes.map((type) => (
            <MetricCard
              key={type}
              type={type}
              current={currentMetrics[type]}
              history={metricHistories[type]}
              onViewDetails={() => setSelectedMetric(type)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredTypes.map((type) => {
                const config = metricConfigs[type];
                const current = currentMetrics[type];
                const Icon = config.icon;
                const isNormal = isInNormalRange(type, current.value);
                
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-4 hover-elevate cursor-pointer"
                    onClick={() => setSelectedMetric(type)}
                    data-testid={`row-metric-${type}`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-md" 
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: config.color }} />
                      </div>
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground">
                          Last: {format(parseISO(current.recordedAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold">{current.value}</p>
                        <p className="text-xs text-muted-foreground">{config.unit}</p>
                      </div>
                      <Badge variant={isNormal ? "outline" : "destructive"}>
                        {isNormal ? "Normal" : "Attention"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Health Data Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This health metrics tracking is for personal reference only and is NOT a substitute for 
            professional medical advice, diagnosis, or treatment. Always consult with qualified 
            healthcare providers for medical decisions. The normal ranges shown are general guidelines 
            and may not apply to your specific health situation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
