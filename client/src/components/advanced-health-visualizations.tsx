import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Scale,
  Calendar,
  BarChart3,
  LineChartIcon,
  Map,
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  Download,
  Maximize2,
  Pill,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface TrendDataPoint {
  date: string;
  value: number;
  normalLow?: number;
  normalHigh?: number;
  metadata?: Record<string, any>;
}

interface VitalTrendData {
  bloodPressureSystolic: TrendDataPoint[];
  bloodPressureDiastolic: TrendDataPoint[];
  heartRate: TrendDataPoint[];
  temperature: TrendDataPoint[];
  respiratoryRate: TrendDataPoint[];
  oxygenSaturation: TrendDataPoint[];
  weight: TrendDataPoint[];
}

interface LabTrendData {
  glucose: TrendDataPoint[];
  hba1c: TrendDataPoint[];
  cholesterolTotal: TrendDataPoint[];
  cholesterolLDL: TrendDataPoint[];
  cholesterolHDL: TrendDataPoint[];
  triglycerides: TrendDataPoint[];
  creatinine: TrendDataPoint[];
  egfr: TrendDataPoint[];
}

interface MedicationAdherenceData {
  date: string;
  taken: number;
  missed: number;
  late: number;
  total: number;
  medications: { name: string; status: "taken" | "missed" | "late" }[];
}

interface PatientLocationData {
  patientId: string;
  patientName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  zipCode: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  lastVisit: string;
  conditions: string[];
}

type TimeframeOption = "7d" | "30d" | "90d" | "6m" | "1y" | "2y" | "all";

const timeframeLabels: Record<TimeframeOption, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  "6m": "6 Months",
  "1y": "1 Year",
  "2y": "2 Years",
  "all": "All Time",
};

const COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#06b6d4",
  muted: "#94a3b8",
};

function filterDataByTimeframe(data: TrendDataPoint[], timeframe: TimeframeOption): TrendDataPoint[] {
  if (timeframe === "all") return data;
  
  const now = new Date();
  const cutoff = new Date();
  
  switch (timeframe) {
    case "7d": cutoff.setDate(now.getDate() - 7); break;
    case "30d": cutoff.setDate(now.getDate() - 30); break;
    case "90d": cutoff.setDate(now.getDate() - 90); break;
    case "6m": cutoff.setMonth(now.getMonth() - 6); break;
    case "1y": cutoff.setFullYear(now.getFullYear() - 1); break;
    case "2y": cutoff.setFullYear(now.getFullYear() - 2); break;
  }
  
  return data.filter(d => new Date(d.date) >= cutoff);
}

function calculateTrend(data: TrendDataPoint[]): { direction: "up" | "down" | "stable"; percentage: number } {
  if (data.length < 2) return { direction: "stable", percentage: 0 };
  
  const recent = data.slice(-Math.min(5, data.length));
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const change = ((last - first) / first) * 100;
  
  if (Math.abs(change) < 2) return { direction: "stable", percentage: 0 };
  return { direction: change > 0 ? "up" : "down", percentage: Math.abs(change) };
}

function TrendIndicator({ direction, percentage }: { direction: "up" | "down" | "stable"; percentage: number }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const color = direction === "up" ? "text-green-500" : direction === "down" ? "text-red-500" : "text-gray-500";
  
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-4 w-4" />
      {percentage > 0 && <span className="text-xs font-medium">{percentage.toFixed(1)}%</span>}
    </div>
  );
}

function TimeframeSelector({ value, onChange }: { value: TimeframeOption; onChange: (v: TimeframeOption) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32" data-testid="select-timeframe">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(timeframeLabels).map(([key, label]) => (
          <SelectItem key={key} value={key}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface LongTermVitalsTrendProps {
  data: VitalTrendData;
  height?: number;
  showBrush?: boolean;
}

export function LongTermVitalsTrend({ data, height = 400, showBrush = true }: LongTermVitalsTrendProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("90d");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["bloodPressureSystolic", "heartRate"]);
  const [showNormalRange, setShowNormalRange] = useState(true);

  const metrics = [
    { id: "bloodPressureSystolic", label: "BP Systolic", unit: "mmHg", color: COLORS.danger, icon: Heart, normalLow: 90, normalHigh: 120 },
    { id: "bloodPressureDiastolic", label: "BP Diastolic", unit: "mmHg", color: COLORS.warning, icon: Heart, normalLow: 60, normalHigh: 80 },
    { id: "heartRate", label: "Heart Rate", unit: "bpm", color: COLORS.primary, icon: Activity, normalLow: 60, normalHigh: 100 },
    { id: "temperature", label: "Temperature", unit: "°F", color: COLORS.info, icon: Thermometer, normalLow: 97, normalHigh: 99 },
    { id: "respiratoryRate", label: "Resp. Rate", unit: "/min", color: COLORS.secondary, icon: Droplets, normalLow: 12, normalHigh: 20 },
    { id: "oxygenSaturation", label: "SpO2", unit: "%", color: COLORS.success, icon: Droplets, normalLow: 95, normalHigh: 100 },
    { id: "weight", label: "Weight", unit: "lbs", color: COLORS.muted, icon: Scale },
  ];

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId)
        ? prev.filter(m => m !== metricId)
        : [...prev, metricId].slice(-4)
    );
  };

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    selectedMetrics.forEach(metricId => {
      const metricData = data[metricId as keyof VitalTrendData] || [];
      filterDataByTimeframe(metricData, timeframe).forEach(d => allDates.add(d.date));
    });

    return Array.from(allDates).sort().map(date => {
      const point: any = { date: new Date(date).toLocaleDateString() };
      selectedMetrics.forEach(metricId => {
        const metricData = data[metricId as keyof VitalTrendData] || [];
        const found = metricData.find(d => d.date === date);
        point[metricId] = found?.value;
      });
      return point;
    });
  }, [data, selectedMetrics, timeframe]);

  const statistics = useMemo(() => {
    return selectedMetrics.map(metricId => {
      const metricInfo = metrics.find(m => m.id === metricId);
      const metricData = filterDataByTimeframe(data[metricId as keyof VitalTrendData] || [], timeframe);
      const values = metricData.map(d => d.value).filter(v => v !== undefined);
      
      if (values.length === 0) return null;
      
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const trend = calculateTrend(metricData);
      
      return { metricId, metricInfo, avg, min, max, trend, count: values.length };
    }).filter(Boolean);
  }, [data, selectedMetrics, timeframe]);

  return (
    <Card data-testid="chart-long-term-vitals">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Long-Term Vital Signs Trend
            </CardTitle>
            <CardDescription>Track vital sign patterns over extended periods</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <div className="flex items-center gap-2">
              <Switch
                id="show-normal"
                checked={showNormalRange}
                onCheckedChange={setShowNormalRange}
              />
              <Label htmlFor="show-normal" className="text-xs">Normal Range</Label>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {metrics.map(metric => (
            <Button
              key={metric.id}
              variant={selectedMetrics.includes(metric.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMetric(metric.id)}
              className="text-xs"
              style={selectedMetrics.includes(metric.id) ? { backgroundColor: metric.color } : {}}
              data-testid={`toggle-vital-${metric.id}`}
            >
              {metric.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {statistics.map((stat: any) => stat && (
            <div key={stat.metricId} className="p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {stat.metricInfo?.icon && <stat.metricInfo.icon className="h-3 w-3" />}
                {stat.metricInfo?.label}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold">{stat.avg.toFixed(1)}</span>
                <TrendIndicator direction={stat.trend.direction} percentage={stat.trend.percentage} />
              </div>
              <div className="text-xs text-muted-foreground">
                Range: {stat.min.toFixed(0)} - {stat.max.toFixed(0)} {stat.metricInfo?.unit}
              </div>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
            />
            <Legend />
            {selectedMetrics.map(metricId => {
              const metric = metrics.find(m => m.id === metricId);
              if (!metric) return null;
              
              return (
                <Line
                  key={metricId}
                  type="monotone"
                  dataKey={metricId}
                  name={metric.label}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              );
            })}
            {showNormalRange && selectedMetrics.map(metricId => {
              const metric = metrics.find(m => m.id === metricId);
              if (!metric?.normalLow) return null;
              
              return [
                <ReferenceLine
                  key={`${metricId}-low`}
                  y={metric.normalLow}
                  stroke={metric.color}
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />,
                <ReferenceLine
                  key={`${metricId}-high`}
                  y={metric.normalHigh}
                  stroke={metric.color}
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />,
              ];
            })}
            {showBrush && <Brush dataKey="date" height={30} stroke={COLORS.primary} />}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface LongTermLabsTrendProps {
  data: LabTrendData;
  height?: number;
  showBrush?: boolean;
}

export function LongTermLabsTrend({ data, height = 400, showBrush = true }: LongTermLabsTrendProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1y");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["glucose", "hba1c"]);
  const [chartType, setChartType] = useState<"line" | "area">("line");

  const metrics = [
    { id: "glucose", label: "Glucose", unit: "mg/dL", color: COLORS.primary, normalLow: 70, normalHigh: 100 },
    { id: "hba1c", label: "HbA1c", unit: "%", color: COLORS.danger, normalLow: 4.0, normalHigh: 5.7 },
    { id: "cholesterolTotal", label: "Total Chol.", unit: "mg/dL", color: COLORS.warning, normalHigh: 200 },
    { id: "cholesterolLDL", label: "LDL", unit: "mg/dL", color: COLORS.danger, normalHigh: 100 },
    { id: "cholesterolHDL", label: "HDL", unit: "mg/dL", color: COLORS.success, normalLow: 40 },
    { id: "triglycerides", label: "Triglycerides", unit: "mg/dL", color: COLORS.secondary, normalHigh: 150 },
    { id: "creatinine", label: "Creatinine", unit: "mg/dL", color: COLORS.info, normalLow: 0.7, normalHigh: 1.3 },
    { id: "egfr", label: "eGFR", unit: "mL/min", color: COLORS.muted, normalLow: 60 },
  ];

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId)
        ? prev.filter(m => m !== metricId)
        : [...prev, metricId].slice(-3)
    );
  };

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    selectedMetrics.forEach(metricId => {
      const metricData = data[metricId as keyof LabTrendData] || [];
      filterDataByTimeframe(metricData, timeframe).forEach(d => allDates.add(d.date));
    });

    return Array.from(allDates).sort().map(date => {
      const point: any = { date: new Date(date).toLocaleDateString() };
      selectedMetrics.forEach(metricId => {
        const metricData = data[metricId as keyof LabTrendData] || [];
        const found = metricData.find(d => d.date === date);
        point[metricId] = found?.value;
      });
      return point;
    });
  }, [data, selectedMetrics, timeframe]);

  const ChartComponent = chartType === "area" ? AreaChart : LineChart;

  return (
    <Card data-testid="chart-long-term-labs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Long-Term Lab Results Trend
            </CardTitle>
            <CardDescription>Track lab values over time with normal ranges</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartType(chartType === "line" ? "area" : "line")}
              data-testid="toggle-chart-type"
            >
              {chartType === "line" ? <BarChart3 className="h-4 w-4" /> : <LineChartIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {metrics.map(metric => (
            <Button
              key={metric.id}
              variant={selectedMetrics.includes(metric.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMetric(metric.id)}
              className="text-xs"
              style={selectedMetrics.includes(metric.id) ? { backgroundColor: metric.color } : {}}
              data-testid={`toggle-lab-${metric.id}`}
            >
              {metric.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
            />
            <Legend />
            {selectedMetrics.map(metricId => {
              const metric = metrics.find(m => m.id === metricId);
              if (!metric) return null;
              
              if (chartType === "area") {
                return (
                  <Area
                    key={metricId}
                    type="monotone"
                    dataKey={metricId}
                    name={metric.label}
                    stroke={metric.color}
                    fill={metric.color}
                    fillOpacity={0.2}
                  />
                );
              }
              
              return (
                <Line
                  key={metricId}
                  type="monotone"
                  dataKey={metricId}
                  name={metric.label}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              );
            })}
            {showBrush && <Brush dataKey="date" height={30} stroke={COLORS.primary} />}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface MedicationAdherencePatternProps {
  data: MedicationAdherenceData[];
  height?: number;
}

export function MedicationAdherencePattern({ data, height = 400 }: MedicationAdherencePatternProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("30d");
  const [viewType, setViewType] = useState<"calendar" | "chart" | "summary">("chart");

  const filteredData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case "7d": cutoff.setDate(now.getDate() - 7); break;
      case "30d": cutoff.setDate(now.getDate() - 30); break;
      case "90d": cutoff.setDate(now.getDate() - 90); break;
      default: cutoff.setDate(now.getDate() - 30);
    }
    
    return data.filter(d => new Date(d.date) >= cutoff);
  }, [data, timeframe]);

  const statistics = useMemo(() => {
    const totalDoses = filteredData.reduce((sum, d) => sum + d.total, 0);
    const takenDoses = filteredData.reduce((sum, d) => sum + d.taken, 0);
    const missedDoses = filteredData.reduce((sum, d) => sum + d.missed, 0);
    const lateDoses = filteredData.reduce((sum, d) => sum + d.late, 0);
    
    const adherenceRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    const onTimeRate = totalDoses > 0 ? (takenDoses / (totalDoses - lateDoses)) * 100 : 0;
    
    const streak = (() => {
      let currentStreak = 0;
      for (let i = filteredData.length - 1; i >= 0; i--) {
        if (filteredData[i].taken === filteredData[i].total) {
          currentStreak++;
        } else {
          break;
        }
      }
      return currentStreak;
    })();
    
    return { totalDoses, takenDoses, missedDoses, lateDoses, adherenceRate, onTimeRate, streak };
  }, [filteredData]);

  const chartData = filteredData.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    taken: d.taken,
    missed: d.missed,
    late: d.late,
    adherence: d.total > 0 ? (d.taken / d.total) * 100 : 0,
  }));

  const calendarData = useMemo(() => {
    const weeks: { date: Date; status: "full" | "partial" | "missed" | "none" }[][] = [];
    let currentWeek: { date: Date; status: "full" | "partial" | "missed" | "none" }[] = [];
    
    filteredData.forEach((d, i) => {
      const date = new Date(d.date);
      const status = d.taken === d.total ? "full" : d.taken > 0 ? "partial" : d.missed > 0 ? "missed" : "none";
      
      currentWeek.push({ date, status });
      
      if (date.getDay() === 6 || i === filteredData.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  }, [filteredData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "full": return "bg-green-500";
      case "partial": return "bg-yellow-500";
      case "missed": return "bg-red-500";
      default: return "bg-gray-200 dark:bg-gray-700";
    }
  };

  return (
    <Card data-testid="chart-medication-adherence">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Medication Adherence Patterns
            </CardTitle>
            <CardDescription>Track medication taking patterns and identify trends</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="chart" className="text-xs px-2" data-testid="tab-adherence-chart">Chart</TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs px-2" data-testid="tab-adherence-calendar">Calendar</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs px-2" data-testid="tab-adherence-summary">Summary</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Adherence Rate</span>
            </div>
            <div className="text-2xl font-bold mt-1">{statistics.adherenceRate.toFixed(1)}%</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-600">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">Current Streak</span>
            </div>
            <div className="text-2xl font-bold mt-1">{statistics.streak} days</div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Late Doses</span>
            </div>
            <div className="text-2xl font-bold mt-1">{statistics.lateDoses}</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Missed Doses</span>
            </div>
            <div className="text-2xl font-bold mt-1">{statistics.missedDoses}</div>
          </div>
        </div>

        {viewType === "chart" && (
          <ResponsiveContainer width="100%" height={height - 100}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="taken" name="Taken" stackId="a" fill={COLORS.success} />
              <Bar yAxisId="left" dataKey="late" name="Late" stackId="a" fill={COLORS.warning} />
              <Bar yAxisId="left" dataKey="missed" name="Missed" stackId="a" fill={COLORS.danger} />
              <Line yAxisId="right" type="monotone" dataKey="adherence" name="Adherence %" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              <ReferenceLine yAxisId="right" y={80} stroke={COLORS.success} strokeDasharray="5 5" label="Target" />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {viewType === "calendar" && (
          <div className="space-y-2">
            <div className="flex gap-2 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> All taken</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500" /> Partial</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> Missed</div>
            </div>
            <div className="grid gap-1">
              {calendarData.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`w-6 h-6 rounded ${getStatusColor(day.status)}`}
                      title={`${day.date.toLocaleDateString()}: ${day.status}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewType === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Daily Breakdown</h4>
                <div className="space-y-1">
                  {filteredData.slice(-7).reverse().map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <Badge variant={d.taken === d.total ? "default" : d.missed > 0 ? "destructive" : "secondary"}>
                        {d.taken}/{d.total}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Medication Status</h4>
                <div className="space-y-1">
                  {filteredData[filteredData.length - 1]?.medications.map((med, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{med.name}</span>
                      <Badge variant={med.status === "taken" ? "default" : med.status === "late" ? "secondary" : "destructive"}>
                        {med.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PatientGeographicMapProps {
  data: PatientLocationData[];
  height?: number;
}

export function PatientGeographicMap({ data, height = 400 }: PatientGeographicMapProps) {
  const [selectedRisk, setSelectedRisk] = useState<string>("all");
  const [hoveredPatient, setHoveredPatient] = useState<PatientLocationData | null>(null);

  const filteredData = useMemo(() => {
    if (selectedRisk === "all") return data;
    return data.filter(p => p.riskLevel === selectedRisk);
  }, [data, selectedRisk]);

  const statistics = useMemo(() => {
    const byState: Record<string, number> = {};
    const byRisk = { low: 0, moderate: 0, high: 0, critical: 0 };
    
    data.forEach(p => {
      byState[p.state] = (byState[p.state] || 0) + 1;
      byRisk[p.riskLevel]++;
    });
    
    const sortedStates = Object.entries(byState).sort((a, b) => b[1] - a[1]);
    return { byState: sortedStates, byRisk };
  }, [data]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical": return COLORS.danger;
      case "high": return COLORS.warning;
      case "moderate": return "#fbbf24";
      case "low": return COLORS.success;
      default: return COLORS.muted;
    }
  };

  const scatterData = filteredData.map(p => ({
    x: p.longitude,
    y: p.latitude,
    z: p.riskLevel === "critical" ? 100 : p.riskLevel === "high" ? 70 : p.riskLevel === "moderate" ? 40 : 20,
    ...p,
  }));

  return (
    <Card data-testid="chart-patient-map">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4" />
              Patient Geographic Distribution
            </CardTitle>
            <CardDescription>Visualize patient locations and risk levels</CardDescription>
          </div>
          <Select value={selectedRisk} onValueChange={setSelectedRisk}>
            <SelectTrigger className="w-32" data-testid="select-risk-filter">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={height}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Longitude"
                  domain={[-130, -65]}
                  tick={{ fontSize: 10 }}
                  label={{ value: "Longitude", position: "bottom", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Latitude"
                  domain={[24, 50]}
                  tick={{ fontSize: 10 }}
                  label={{ value: "Latitude", angle: -90, position: "left", fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload as PatientLocationData;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <div className="font-medium">{p.patientName}</div>
                          <div className="text-sm text-muted-foreground">{p.city}, {p.state}</div>
                          <Badge className={`mt-1 ${getRiskColor(p.riskLevel)}`}>{p.riskLevel} risk</Badge>
                          <div className="text-xs mt-1">Last visit: {new Date(p.lastVisit).toLocaleDateString()}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Patients" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getRiskColor(entry.riskLevel)}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Risk Distribution</h4>
              <div className="space-y-2">
                {Object.entries(statistics.byRisk).map(([risk, count]) => (
                  <div key={risk} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRiskColor(risk) }} />
                      <span className="text-sm capitalize">{risk}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">Top States</h4>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {statistics.byState.slice(0, 10).map(([state, count]) => (
                    <div key={state} className="flex items-center justify-between text-sm">
                      <span>{state}</span>
                      <span className="text-muted-foreground">{count} patients</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardWidget {
  id: string;
  type: "vitals" | "labs" | "adherence" | "map" | "alerts" | "summary";
  title: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
}

interface CustomizableDashboardProps {
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
  vitalsData?: VitalTrendData;
  labsData?: LabTrendData;
  adherenceData?: MedicationAdherenceData[];
  locationData?: PatientLocationData[];
  children?: React.ReactNode;
}

export function CustomizableDashboard({
  widgets,
  onWidgetsChange,
  vitalsData,
  labsData,
  adherenceData,
  locationData,
  children,
}: CustomizableDashboardProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);

  const toggleWidget = (widgetId: string) => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    onWidgetsChange(updated);
  };

  const changeWidgetSize = (widgetId: string, size: "small" | "medium" | "large") => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, size } : w
    );
    onWidgetsChange(updated);
  };

  const moveWidget = (widgetId: string, direction: "up" | "down") => {
    const index = widgets.findIndex(w => w.id === widgetId);
    if (index < 0) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;
    
    const updated = [...widgets];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((w, i) => w.order = i);
    onWidgetsChange(updated);
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);

  const getWidgetColSpan = (size: string) => {
    switch (size) {
      case "large": return "lg:col-span-2";
      case "medium": return "lg:col-span-1";
      case "small": return "lg:col-span-1";
      default: return "";
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.type) {
      case "vitals":
        return vitalsData ? <LongTermVitalsTrend data={vitalsData} height={300} showBrush={widget.size === "large"} /> : null;
      case "labs":
        return labsData ? <LongTermLabsTrend data={labsData} height={300} showBrush={widget.size === "large"} /> : null;
      case "adherence":
        return adherenceData ? <MedicationAdherencePattern data={adherenceData} height={300} /> : null;
      case "map":
        return locationData ? <PatientGeographicMap data={locationData} height={300} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <Button
          variant={isCustomizing ? "default" : "outline"}
          size="sm"
          onClick={() => setIsCustomizing(!isCustomizing)}
          data-testid="button-customize-dashboard"
        >
          <Settings className="h-4 w-4 mr-2" />
          {isCustomizing ? "Done" : "Customize"}
        </Button>
      </div>

      {isCustomizing && (
        <Card className="p-4" data-testid="dashboard-customization-panel">
          <h3 className="font-medium mb-3">Dashboard Widgets</h3>
          <div className="space-y-2">
            {widgets.map(widget => (
              <div
                key={widget.id}
                className="flex items-center justify-between p-2 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <Switch
                    checked={widget.enabled}
                    onCheckedChange={() => toggleWidget(widget.id)}
                    data-testid={`toggle-widget-${widget.id}`}
                  />
                  <span className={widget.enabled ? "" : "text-muted-foreground"}>{widget.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={widget.size}
                    onValueChange={(v) => changeWidgetSize(widget.id, v as any)}
                    disabled={!widget.enabled}
                  >
                    <SelectTrigger className="w-24 h-8" data-testid={`select-widget-size-${widget.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveWidget(widget.id, "up")}
                    disabled={widgets.indexOf(widget) === 0}
                    className="h-8 w-8"
                  >
                    <TrendingUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveWidget(widget.id, "down")}
                    disabled={widgets.indexOf(widget) === widgets.length - 1}
                    className="h-8 w-8"
                  >
                    <TrendingDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {enabledWidgets.map(widget => (
          <div key={widget.id} className={getWidgetColSpan(widget.size)}>
            {renderWidget(widget)}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}

export const defaultDashboardWidgets: DashboardWidget[] = [
  { id: "vitals", type: "vitals", title: "Vital Signs Trends", enabled: true, order: 0, size: "large" },
  { id: "labs", type: "labs", title: "Lab Results Trends", enabled: true, order: 1, size: "large" },
  { id: "adherence", type: "adherence", title: "Medication Adherence", enabled: true, order: 2, size: "medium" },
  { id: "map", type: "map", title: "Patient Geographic Map", enabled: true, order: 3, size: "medium" },
];

export function generateSampleVitalsData(): VitalTrendData {
  const generateTrend = (baseValue: number, variance: number, count: number): TrendDataPoint[] => {
    const data: TrendDataPoint[] = [];
    const now = new Date();
    
    for (let i = count; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString(),
        value: baseValue + (Math.random() - 0.5) * variance * 2,
      });
    }
    
    return data;
  };
  
  return {
    bloodPressureSystolic: generateTrend(120, 15, 180),
    bloodPressureDiastolic: generateTrend(80, 10, 180),
    heartRate: generateTrend(72, 12, 180),
    temperature: generateTrend(98.6, 0.8, 180),
    respiratoryRate: generateTrend(16, 4, 180),
    oxygenSaturation: generateTrend(97, 2, 180),
    weight: generateTrend(175, 5, 180),
  };
}

export function generateSampleLabsData(): LabTrendData {
  const generateTrend = (baseValue: number, variance: number, count: number): TrendDataPoint[] => {
    const data: TrendDataPoint[] = [];
    const now = new Date();
    
    for (let i = count; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 14);
      data.push({
        date: date.toISOString(),
        value: baseValue + (Math.random() - 0.5) * variance * 2,
      });
    }
    
    return data;
  };
  
  return {
    glucose: generateTrend(100, 25, 24),
    hba1c: generateTrend(6.5, 0.8, 12),
    cholesterolTotal: generateTrend(190, 30, 12),
    cholesterolLDL: generateTrend(110, 20, 12),
    cholesterolHDL: generateTrend(55, 10, 12),
    triglycerides: generateTrend(140, 40, 12),
    creatinine: generateTrend(1.0, 0.2, 12),
    egfr: generateTrend(85, 15, 12),
  };
}

export function generateSampleAdherenceData(): MedicationAdherenceData[] {
  const data: MedicationAdherenceData[] = [];
  const now = new Date();
  
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const meds = [
      { name: "Metformin", status: Math.random() > 0.1 ? "taken" : Math.random() > 0.5 ? "late" : "missed" },
      { name: "Lisinopril", status: Math.random() > 0.15 ? "taken" : Math.random() > 0.5 ? "late" : "missed" },
      { name: "Atorvastatin", status: Math.random() > 0.12 ? "taken" : Math.random() > 0.5 ? "late" : "missed" },
    ] as { name: string; status: "taken" | "missed" | "late" }[];
    
    const taken = meds.filter(m => m.status === "taken").length;
    const missed = meds.filter(m => m.status === "missed").length;
    const late = meds.filter(m => m.status === "late").length;
    
    data.push({
      date: date.toISOString(),
      taken,
      missed,
      late,
      total: meds.length,
      medications: meds,
    });
  }
  
  return data;
}

export function generateSampleLocationData(): PatientLocationData[] {
  const states = [
    { state: "MA", cities: ["Boston", "Cambridge", "Worcester"], lat: 42.3, lng: -71.1 },
    { state: "NY", cities: ["New York", "Albany", "Buffalo"], lat: 40.7, lng: -74.0 },
    { state: "CA", cities: ["Los Angeles", "San Francisco", "San Diego"], lat: 34.0, lng: -118.2 },
    { state: "TX", cities: ["Houston", "Dallas", "Austin"], lat: 29.8, lng: -95.4 },
    { state: "FL", cities: ["Miami", "Orlando", "Tampa"], lat: 25.8, lng: -80.2 },
    { state: "IL", cities: ["Chicago", "Springfield", "Peoria"], lat: 41.9, lng: -87.6 },
  ];
  
  const riskLevels: ("low" | "moderate" | "high" | "critical")[] = ["low", "moderate", "high", "critical"];
  const conditions = ["Diabetes", "Hypertension", "COPD", "Heart Disease", "Asthma"];
  
  const data: PatientLocationData[] = [];
  
  for (let i = 0; i < 50; i++) {
    const stateInfo = states[Math.floor(Math.random() * states.length)];
    const city = stateInfo.cities[Math.floor(Math.random() * stateInfo.cities.length)];
    
    data.push({
      patientId: `patient-${i + 1}`,
      patientName: `Patient ${i + 1}`,
      latitude: stateInfo.lat + (Math.random() - 0.5) * 4,
      longitude: stateInfo.lng + (Math.random() - 0.5) * 4,
      city,
      state: stateInfo.state,
      zipCode: `${10000 + Math.floor(Math.random() * 90000)}`,
      riskLevel: riskLevels[Math.floor(Math.random() * riskLevels.length)],
      lastVisit: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      conditions: conditions.slice(0, Math.floor(Math.random() * 3) + 1),
    });
  }
  
  return data;
}
