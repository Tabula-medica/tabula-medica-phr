import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
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
  Cell,
  ReferenceLine,
  Brush,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Pill,
  Stethoscope,
  Heart,
  Info,
  ZoomIn,
  ZoomOut,
  Download,
} from "lucide-react";

const CHART_COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  lime: "#84cc16",
};

type TimeframeOption = "7d" | "30d" | "90d" | "1y" | "all";

interface TimeframeFilterProps {
  value: TimeframeOption;
  onChange: (value: TimeframeOption) => void;
  className?: string;
}

export function TimeframeFilter({ value, onChange, className }: TimeframeFilterProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`} data-testid="timeframe-filter">
      {(["7d", "30d", "90d", "1y", "all"] as TimeframeOption[]).map((tf) => (
        <Button
          key={tf}
          variant={value === tf ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(tf)}
          data-testid={`timeframe-${tf}`}
          className="px-2 py-1 text-xs"
        >
          {tf === "all" ? "All" : tf.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

function filterDataByTimeframe<T extends { date: string }>(data: T[], timeframe: TimeframeOption): T[] {
  if (timeframe === "all" || !data.length) return data;
  
  const now = new Date();
  const cutoff = new Date();
  
  switch (timeframe) {
    case "7d":
      cutoff.setDate(now.getDate() - 7);
      break;
    case "30d":
      cutoff.setDate(now.getDate() - 30);
      break;
    case "90d":
      cutoff.setDate(now.getDate() - 90);
      break;
    case "1y":
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return data.filter((item) => new Date(item.date) >= cutoff);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTrendIndicator(data: { value: number }[], threshold?: { low?: number; high?: number }) {
  if (data.length < 2) return { icon: Minus, color: "text-muted-foreground", label: "Stable" };
  
  const recent = data.slice(-3).reduce((sum, d) => sum + d.value, 0) / Math.min(3, data.length);
  const earlier = data.slice(0, 3).reduce((sum, d) => sum + d.value, 0) / Math.min(3, data.length);
  const diff = ((recent - earlier) / earlier) * 100;
  
  if (Math.abs(diff) < 5) return { icon: Minus, color: "text-muted-foreground", label: "Stable" };
  if (diff > 0) return { icon: TrendingUp, color: "text-green-500", label: `+${diff.toFixed(1)}%` };
  return { icon: TrendingDown, color: "text-red-500", label: `${diff.toFixed(1)}%` };
}

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (value: number) => string;
  showDetails?: boolean;
  detailFields?: string[];
}

function EnhancedChartTooltip({ active, payload, label, valueFormatter = (v) => v.toString(), showDetails = true, detailFields }: EnhancedTooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 min-w-[180px]" data-testid="chart-tooltip">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium">{valueFormatter(entry.value)}</span>
        </div>
      ))}
      {showDetails && payload[0]?.payload?.details && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          {Object.entries(payload[0].payload.details).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span>{key}:</span>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MedicationAdherenceChartProps {
  data: { date: string; value: number; details?: Record<string, any> }[];
  height?: number;
  showBrush?: boolean;
  viewMode?: "patient" | "provider";
}

export function MedicationAdherenceChart({ data, height = 300, showBrush = false, viewMode = "patient" }: MedicationAdherenceChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("90d");
  
  const filteredData = useMemo(() => 
    filterDataByTimeframe(data, timeframe).map(d => ({
      ...d,
      date: formatDate(d.date),
      rawDate: d.date,
      details: d.details || {
        "Date": formatDate(d.date),
        "Adherence Rate": `${d.value}%`,
        "Status": d.value >= 80 ? "On Target" : d.value >= 60 ? "Needs Improvement" : "Below Target",
      },
    })), [data, timeframe]);
  
  const trend = getTrendIndicator(filteredData);
  const avgAdherence = filteredData.length ? 
    Math.round(filteredData.reduce((sum, d) => sum + d.value, 0) / filteredData.length) : 0;

  return (
    <Card data-testid="chart-medication-adherence">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Medication Adherence Trend
            </CardTitle>
            <CardDescription>Track your medication compliance over time</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <trend.icon className={`w-4 h-4 ${trend.color}`} />
              <span className={`text-sm ${trend.color}`}>{trend.label}</span>
            </div>
            <Badge variant="outline" className="text-xs">Avg: {avgAdherence}%</Badge>
          </div>
        </div>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="Line chart showing medication adherence percentage over time">
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<EnhancedChartTooltip valueFormatter={(v) => `${v}%`} />} />
              <ReferenceLine y={80} stroke={CHART_COLORS.success} strokeDasharray="5 5" label={{ value: "Target 80%", position: "right", fontSize: 10 }} />
              <Area 
                type="monotone" 
                dataKey="value" 
                name="Adherence" 
                stroke={CHART_COLORS.primary} 
                strokeWidth={2}
                fill="url(#adherenceGradient)"
                dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: CHART_COLORS.primary, strokeWidth: 2 }}
              />
              {showBrush && <Brush dataKey="date" height={30} stroke={CHART_COLORS.primary} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {viewMode === "patient" && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Green dashed line indicates 80% adherence target. Hover over points for details.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface MedicationTimelineChartProps {
  medications: {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    status: string;
    category: string;
    adherenceRate?: number;
  }[];
  height?: number;
}

export function MedicationTimelineChart({ medications, height = 250 }: MedicationTimelineChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1y");
  
  const categories = useMemo(() => 
    ["all", ...Array.from(new Set(medications.map(m => m.category)))], [medications]);
  
  const filteredMeds = useMemo(() => {
    let meds = selectedCategory === "all" ? medications : medications.filter(m => m.category === selectedCategory);
    if (timeframe !== "all") {
      const cutoff = new Date();
      switch (timeframe) {
        case "7d": cutoff.setDate(cutoff.getDate() - 7); break;
        case "30d": cutoff.setDate(cutoff.getDate() - 30); break;
        case "90d": cutoff.setDate(cutoff.getDate() - 90); break;
        case "1y": cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }
      meds = meds.filter(m => new Date(m.startDate) >= cutoff || (m.endDate ? new Date(m.endDate) >= cutoff : true));
    }
    return meds;
  }, [medications, selectedCategory, timeframe]);

  const timelineData = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return filteredMeds.map(med => {
      const start = new Date(med.startDate);
      const end = med.endDate ? new Date(med.endDate) : now;
      const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const startOffset = Math.max(0, Math.ceil((start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        name: med.name,
        offset: startOffset,
        duration: durationDays,
        status: med.status,
        adherence: med.adherenceRate || 0,
        category: med.category,
        details: {
          "Start Date": formatDate(med.startDate),
          "End Date": med.endDate ? formatDate(med.endDate) : "Ongoing",
          "Duration": `${durationDays} days`,
          "Adherence": med.adherenceRate ? `${med.adherenceRate}%` : "N/A",
        },
      };
    });
  }, [filteredMeds]);

  return (
    <Card data-testid="chart-medication-timeline">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Medication Timeline
            </CardTitle>
            <CardDescription>Duration and overlap of medications this year</CardDescription>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[140px]" data-testid="select-med-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat === "all" ? "All Categories" : cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="Gantt-style chart showing medication duration over time">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={timelineData} layout="vertical" stackOffset="none">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 365]} tick={{ fontSize: 10 }} tickFormatter={(v) => {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthIndex = Math.floor(v / 30);
                return months[Math.min(monthIndex, 11)] || "";
              }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
              <Tooltip content={<EnhancedChartTooltip showDetails />} />
              <Bar dataKey="offset" stackId="timeline" fill="transparent" />
              <Bar dataKey="duration" stackId="timeline" radius={[0, 4, 4, 0]}>
                {timelineData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.status === "active" ? CHART_COLORS.success : 
                          entry.status === "completed" ? CHART_COLORS.primary : CHART_COLORS.warning}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: CHART_COLORS.success}} /> Active</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: CHART_COLORS.primary}} /> Completed</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: CHART_COLORS.warning}} /> Other</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConditionProgressionChartProps {
  conditions: {
    id: string;
    name: string;
    clinicalStatus: string;
    severity?: string;
    onsetDate?: string;
    progression: { date: string; status: string; note?: string }[];
  }[];
  height?: number;
}

export function ConditionProgressionChart({ conditions, height = 300 }: ConditionProgressionChartProps) {
  const [selectedCondition, setSelectedCondition] = useState<string>(conditions[0]?.id || "");
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1y");

  const progressionData = useMemo(() => {
    const condition = conditions.find(c => c.id === selectedCondition);
    if (!condition?.progression?.length) return [];
    
    return filterDataByTimeframe(
      condition.progression.map(p => ({
        date: p.date,
        status: p.status,
        value: p.status === "active" ? 3 : p.status === "improving" ? 2 : p.status === "resolved" ? 1 : 2,
        note: p.note,
        details: { Status: p.status, Note: p.note || "No notes" },
      })),
      timeframe
    ).map(d => ({ ...d, date: formatDate(d.date) }));
  }, [conditions, selectedCondition, timeframe]);

  const selectedCond = conditions.find(c => c.id === selectedCondition);

  return (
    <Card data-testid="chart-condition-progression">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Condition Progression
            </CardTitle>
            <CardDescription>Track how conditions change over time</CardDescription>
          </div>
          <Select value={selectedCondition} onValueChange={setSelectedCondition}>
            <SelectTrigger className="w-[180px]" data-testid="select-condition">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {conditions.map(cond => (
                <SelectItem key={cond.id} value={cond.id}>{cond.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} className="mt-2" />
      </CardHeader>
      <CardContent>
        {progressionData.length > 0 ? (
          <div role="img" aria-label="Step chart showing condition status changes over time">
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={progressionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis 
                  domain={[0, 4]} 
                  ticks={[1, 2, 3]} 
                  tickFormatter={(v) => v === 1 ? "Resolved" : v === 2 ? "Improving" : "Active"}
                  tick={{ fontSize: 10 }}
                  width={70}
                />
                <Tooltip content={<EnhancedChartTooltip showDetails />} />
                <Line 
                  type="stepAfter" 
                  dataKey="value" 
                  name="Status"
                  stroke={CHART_COLORS.purple} 
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.purple, strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: CHART_COLORS.purple, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <p>No progression data available for this condition</p>
          </div>
        )}
        {selectedCond && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={selectedCond.clinicalStatus === "active" ? "default" : "secondary"}>
              {selectedCond.clinicalStatus}
            </Badge>
            {selectedCond.severity && (
              <Badge variant="outline">{selectedCond.severity}</Badge>
            )}
            {selectedCond.onsetDate && (
              <span className="text-xs text-muted-foreground">
                Onset: {formatDate(selectedCond.onsetDate)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EncounterFrequencyChartProps {
  data: { date: string; value: number; type?: string; provider?: string }[];
  height?: number;
}

export function EncounterFrequencyChart({ data, height = 300 }: EncounterFrequencyChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1y");
  
  const filteredData = useMemo(() => 
    filterDataByTimeframe(data, timeframe).map(d => ({
      ...d,
      date: formatDate(d.date),
      details: { Type: d.type || "N/A", Provider: d.provider || "N/A" },
    })), [data, timeframe]);

  const trend = getTrendIndicator(filteredData);
  const total = filteredData.reduce((sum, d) => sum + d.value, 0);
  const avgPerMonth = filteredData.length ? (total / filteredData.length).toFixed(1) : "0";

  return (
    <Card data-testid="chart-encounter-frequency">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              Visit Frequency
            </CardTitle>
            <CardDescription>Healthcare encounters over time</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <trend.icon className={`w-4 h-4 ${trend.color}`} />
              <span className={`text-sm ${trend.color}`}>{trend.label}</span>
            </div>
            <Badge variant="outline" className="text-xs">Avg: {avgPerMonth}/mo</Badge>
          </div>
        </div>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="Bar chart showing number of healthcare visits per month">
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={filteredData}>
              <defs>
                <linearGradient id="encounterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<EnhancedChartTooltip valueFormatter={(v) => `${v} visits`} showDetails />} />
              <Bar 
                dataKey="value" 
                name="Visits"
                fill="url(#encounterGradient)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface VitalsLabChartProps {
  vitalsData: {
    bloodPressure: { date: string; value: number; metadata?: { diastolic: number } }[];
    heartRate: { date: string; value: number }[];
    weight: { date: string; value: number }[];
  };
  labsData: {
    glucose: { date: string; value: number }[];
    a1c: { date: string; value: number }[];
    cholesterol: { date: string; value: number }[];
  };
  height?: number;
  viewMode?: "patient" | "provider";
}

export function VitalsLabChart({ vitalsData, labsData, height = 350, viewMode = "patient" }: VitalsLabChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>("90d");
  const [selectedMetric, setSelectedMetric] = useState<string>("bloodPressure");

  const metrics = [
    { id: "bloodPressure", label: "Blood Pressure", unit: "mmHg", icon: Heart, color: CHART_COLORS.danger },
    { id: "heartRate", label: "Heart Rate", unit: "bpm", icon: Activity, color: CHART_COLORS.pink },
    { id: "weight", label: "Weight", unit: "lbs", icon: Activity, color: CHART_COLORS.purple },
    { id: "glucose", label: "Glucose", unit: "mg/dL", icon: Activity, color: CHART_COLORS.warning },
    { id: "a1c", label: "HbA1c", unit: "%", icon: Activity, color: CHART_COLORS.success },
    { id: "cholesterol", label: "Cholesterol", unit: "mg/dL", icon: Activity, color: CHART_COLORS.primary },
  ];

  const selectedMetricInfo = metrics.find(m => m.id === selectedMetric) || metrics[0];

  const chartData = useMemo(() => {
    let rawData: { date: string; value: number; diastolic?: number }[] = [];
    
    if (selectedMetric === "bloodPressure") {
      rawData = vitalsData.bloodPressure.map(d => ({
        date: d.date,
        value: d.value,
        diastolic: d.metadata?.diastolic,
      }));
    } else if (selectedMetric === "heartRate") {
      rawData = vitalsData.heartRate;
    } else if (selectedMetric === "weight") {
      rawData = vitalsData.weight;
    } else if (selectedMetric === "glucose") {
      rawData = labsData.glucose;
    } else if (selectedMetric === "a1c") {
      rawData = labsData.a1c;
    } else if (selectedMetric === "cholesterol") {
      rawData = labsData.cholesterol;
    }
    
    return filterDataByTimeframe(rawData, timeframe).map(d => ({
      ...d,
      date: formatDate(d.date),
      details: selectedMetric === "bloodPressure" ? {
        Systolic: `${d.value} mmHg`,
        Diastolic: d.diastolic ? `${d.diastolic} mmHg` : "N/A",
      } : {
        Value: `${d.value} ${selectedMetricInfo.unit}`,
      },
    }));
  }, [selectedMetric, vitalsData, labsData, timeframe, selectedMetricInfo.unit]);

  const trend = getTrendIndicator(chartData);

  return (
    <Card data-testid="chart-vitals-labs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <selectedMetricInfo.icon className="w-4 h-4" style={{ color: selectedMetricInfo.color }} />
              {selectedMetricInfo.label} Trend
            </CardTitle>
            <CardDescription>Monitor your health metrics over time</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <trend.icon className={`w-4 h-4 ${trend.color}`} />
              <span className={`text-sm ${trend.color}`}>{trend.label}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-[150px]" data-testid="select-metric">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {metrics.map(metric => (
                <SelectItem key={metric.id} value={metric.id}>{metric.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`Line chart showing ${selectedMetricInfo.label} measurements over time`}>
          <ResponsiveContainer width="100%" height={height}>
            {selectedMetric === "bloodPressure" ? (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis domain={[40, 180]} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip content={<EnhancedChartTooltip showDetails />} />
                <Legend />
                <ReferenceLine y={120} stroke={CHART_COLORS.warning} strokeDasharray="5 5" />
                <ReferenceLine y={80} stroke={CHART_COLORS.warning} strokeDasharray="5 5" />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Systolic"
                  stroke={CHART_COLORS.danger} 
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.danger, r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolic" 
                  name="Diastolic"
                  stroke={CHART_COLORS.primary} 
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            ) : (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={selectedMetricInfo.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={selectedMetricInfo.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip content={<EnhancedChartTooltip valueFormatter={(v) => `${v} ${selectedMetricInfo.unit}`} showDetails />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  name={selectedMetricInfo.label}
                  stroke={selectedMetricInfo.color} 
                  strokeWidth={2}
                  fill={`url(#gradient-${selectedMetric})`}
                  dot={{ fill: selectedMetricInfo.color, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        {viewMode === "patient" && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            For informational purposes only. Consult your healthcare provider for medical advice.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface MultiMetricComparisonChartProps {
  data: {
    date: string;
    metrics: Record<string, number>;
  }[];
  availableMetrics: { id: string; label: string; unit: string; color: string }[];
  height?: number;
}

export function MultiMetricComparisonChart({ data, availableMetrics, height = 350 }: MultiMetricComparisonChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    availableMetrics.slice(0, 2).map(m => m.id)
  );
  const [timeframe, setTimeframe] = useState<TimeframeOption>("90d");

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(m => m !== metricId)
        : [...prev, metricId].slice(-3)
    );
  };

  const filteredData = useMemo(() => 
    filterDataByTimeframe(data, timeframe).map(d => ({
      ...d,
      date: formatDate(d.date),
    })), [data, timeframe]);

  return (
    <Card data-testid="chart-multi-metric">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Multi-Metric Comparison</CardTitle>
            <CardDescription>Compare up to 3 metrics side by side</CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {availableMetrics.map(metric => (
            <Button
              key={metric.id}
              variant={selectedMetrics.includes(metric.id) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMetric(metric.id)}
              data-testid={`toggle-metric-${metric.id}`}
              className="text-xs"
              style={selectedMetrics.includes(metric.id) ? { backgroundColor: metric.color } : {}}
            >
              {metric.label}
            </Button>
          ))}
        </div>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div role="img" aria-label="Multi-line chart comparing selected health metrics">
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip content={<EnhancedChartTooltip />} />
              <Legend />
              {selectedMetrics.map(metricId => {
                const metric = availableMetrics.find(m => m.id === metricId);
                if (!metric) return null;
                return (
                  <Line
                    key={metricId}
                    type="monotone"
                    dataKey={`metrics.${metricId}`}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ fill: metric.color, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
