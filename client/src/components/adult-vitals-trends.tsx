import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Heart, Droplet, Thermometer, Wind, Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { AdultVitalTrendData } from "@shared/schema";
import { format } from "date-fns";

const vitalIcons: Record<string, typeof Heart> = {
  blood_pressure_systolic: Heart,
  blood_pressure_diastolic: Heart,
  heart_rate: Activity,
  blood_glucose: Droplet,
  weight: Scale,
  temperature: Thermometer,
  oxygen_saturation: Wind,
  respiratory_rate: Wind,
};

const vitalColors: Record<string, string> = {
  blood_pressure_systolic: "hsl(0, 80%, 55%)",
  blood_pressure_diastolic: "hsl(0, 60%, 65%)",
  heart_rate: "hsl(340, 75%, 55%)",
  blood_glucose: "hsl(30, 80%, 55%)",
  weight: "hsl(210, 70%, 55%)",
  temperature: "hsl(45, 80%, 55%)",
  oxygen_saturation: "hsl(180, 70%, 45%)",
  respiratory_rate: "hsl(150, 60%, 45%)",
};

function VitalTrendCard({ trend }: { trend: AdultVitalTrendData }) {
  const Icon = vitalIcons[trend.vitalType] || Activity;
  const color = vitalColors[trend.vitalType] || "hsl(var(--primary))";

  const data = trend.data.map((d) => ({
    ...d,
    dateLabel: format(new Date(d.date), "MMM yyyy"),
  }));

  const values = data.map((d) => d.value);
  const currentValue = values.length > 0 ? values[values.length - 1] : null;
  const previousValue = values.length > 1 ? values[values.length - 2] : null;
  const change = currentValue !== null && previousValue !== null ? currentValue - previousValue : null;

  const isNormal = trend.normalRange && currentValue !== null
    ? currentValue >= trend.normalRange.low && currentValue <= trend.normalRange.high
    : null;

  if (values.length === 0) {
    return (
      <Card data-testid={`card-vital-trend-${trend.vitalType}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <CardTitle className="text-sm">{trend.label}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground text-sm py-8">No data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.2 || 5;
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);

  return (
    <Card data-testid={`card-vital-trend-${trend.vitalType}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <CardTitle className="text-sm">{trend.label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {currentValue !== null && (
              <span className="text-lg font-bold" data-testid={`text-current-${trend.vitalType}`}>
                {currentValue} <span className="text-xs font-normal text-muted-foreground">{trend.unit}</span>
              </span>
            )}
            {change !== null && (
              <Badge variant={change === 0 ? "secondary" : change > 0 ? "outline" : "outline"} className="text-xs">
                {change > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> :
                  change < 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> :
                    <Minus className="h-3 w-3 mr-0.5" />}
                {change > 0 ? "+" : ""}{change.toFixed(1)}
              </Badge>
            )}
            {isNormal !== null && (
              <Badge
                variant={isNormal ? "default" : "destructive"}
                className="text-xs"
                data-testid={`badge-status-${trend.vitalType}`}
              >
                {isNormal ? "Normal" : "Out of Range"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48" data-testid={`chart-trend-${trend.vitalType}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 10 }}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const entry = payload[0];
                  return (
                    <div className="bg-popover border rounded-md p-2 shadow-md text-sm">
                      <p className="font-medium">{label}</p>
                      <p style={{ color: entry.color }}>
                        {(entry.value as number)?.toFixed(1)} {trend.unit}
                      </p>
                      {trend.normalRange && (
                        <p className="text-xs text-muted-foreground">
                          Normal: {trend.normalRange.low}–{trend.normalRange.high} {trend.unit}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {trend.normalRange && (
                <ReferenceArea
                  y1={trend.normalRange.low}
                  y2={trend.normalRange.high}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.06}
                  strokeOpacity={0}
                />
              )}
              {trend.normalRange && (
                <>
                  <ReferenceLine y={trend.normalRange.high} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={trend.normalRange.low} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                </>
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {trend.normalRange && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded-sm bg-primary/10 border border-muted-foreground/20" />
              <span>Normal range ({trend.normalRange.low}–{trend.normalRange.high} {trend.unit})</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdultVitalsTrends({ patientId = "patient-001" }: { patientId?: string }) {
  const [range, setRange] = useState("6m");
  const [selectedTypes, setSelectedTypes] = useState("all");

  const typesParam = selectedTypes === "all" ? "" : `&types=${selectedTypes}`;

  const { data, isLoading } = useQuery<{ trends: AdultVitalTrendData[] }>({
    queryKey: [`/api/growth-vitals/adult-vital-trends?patientId=${patientId}&range=${range}${typesParam}`],
  });

  const trends = data?.trends || [];

  const vitalGroups = [
    { label: "Blood Pressure", types: ["blood_pressure_systolic", "blood_pressure_diastolic"] },
    { label: "Heart & Lungs", types: ["heart_rate", "oxygen_saturation", "respiratory_rate"] },
    { label: "Metabolic", types: ["blood_glucose", "weight", "temperature"] },
  ];

  return (
    <div className="space-y-6" data-testid="container-adult-vitals-trends">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-adult-trends-title">
            <Activity className="h-5 w-5 text-red-500" />
            Vital Signs Trends
          </h3>
          <p className="text-sm text-muted-foreground">Track your vital sign trends over time with normal range indicators</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTypes} onValueChange={setSelectedTypes}>
            <SelectTrigger className="w-[160px]" data-testid="select-vital-group">
              <SelectValue placeholder="All vitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vitals</SelectItem>
              <SelectItem value="blood_pressure_systolic,blood_pressure_diastolic">Blood Pressure</SelectItem>
              <SelectItem value="heart_rate">Heart Rate</SelectItem>
              <SelectItem value="blood_glucose">Blood Glucose</SelectItem>
              <SelectItem value="weight">Weight</SelectItem>
              <SelectItem value="temperature">Temperature</SelectItem>
              <SelectItem value="oxygen_saturation">Oxygen Saturation</SelectItem>
              <SelectItem value="respiratory_rate">Respiratory Rate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[100px]" data-testid="select-trend-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : trends.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No vital sign data available for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {vitalGroups.map((group) => {
            const groupTrends = trends.filter((t) => group.types.includes(t.vitalType));
            if (groupTrends.length === 0) return null;

            return (
              <div key={group.label} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground" data-testid={`text-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {group.label}
                </h4>
                <div className={`grid gap-4 ${groupTrends.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                  {groupTrends.map((trend) => (
                    <VitalTrendCard key={trend.vitalType} trend={trend} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center" data-testid="text-vitals-disclaimer">
            Vital sign trends are for informational purposes only and do not constitute medical advice.
            Always consult your healthcare provider for medical decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
