import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { Activity, Heart, Thermometer, Droplet, TrendingUp, TrendingDown, Minus, Calendar, Pill, Stethoscope, Building, AlertTriangle } from "lucide-react";

interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: string;
  code: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  authoredOn?: string;
  dosageInstruction?: Array<{ text?: string; timing?: { repeat?: { frequency?: number; period?: number } } }>;
}

interface FhirMedicationStatement {
  resourceType: "MedicationStatement";
  id: string;
  status: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
  dosage?: Array<{ text?: string; timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } } }>;
}

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status: string;
  class: { system?: string; code?: string; display?: string };
  type?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  period?: { start?: string; end?: string };
  reasonCode?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  serviceProvider?: { reference?: string; display?: string };
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const VITAL_CATEGORIES: Record<string, { label: string; icon: typeof Activity; unit: string; normalRange?: { min: number; max: number } }> = {
  "8867-4": { label: "Heart Rate", icon: Heart, unit: "bpm", normalRange: { min: 60, max: 100 } },
  "8310-5": { label: "Body Temperature", icon: Thermometer, unit: "°F", normalRange: { min: 97, max: 99 } },
  "8480-6": { label: "Systolic BP", icon: Activity, unit: "mmHg", normalRange: { min: 90, max: 120 } },
  "8462-4": { label: "Diastolic BP", icon: Activity, unit: "mmHg", normalRange: { min: 60, max: 80 } },
  "2708-6": { label: "Oxygen Saturation", icon: Droplet, unit: "%", normalRange: { min: 95, max: 100 } },
  "29463-7": { label: "Body Weight", icon: Activity, unit: "kg" },
  "8302-2": { label: "Body Height", icon: Activity, unit: "cm" },
  "39156-5": { label: "BMI", icon: Activity, unit: "kg/m²", normalRange: { min: 18.5, max: 25 } },
};

function getTrend(values: number[]): "up" | "down" | "stable" {
  if (values.length < 2) return "stable";
  const recent = values.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const older = values.slice(-6, -3);
  if (older.length === 0) return "stable";
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = avg - olderAvg;
  const threshold = olderAvg * 0.05;
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "stable";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-accent-foreground" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

interface ObservationTrendChartProps {
  observations: FhirObservation[];
  title?: string;
  description?: string;
  selectedMetric?: string;
  onMetricChange?: (metric: string) => void;
}

export function ObservationTrendChart({ 
  observations, 
  title = "Observation Trends",
  description = "Track your vital signs and lab results over time",
  selectedMetric,
  onMetricChange
}: ObservationTrendChartProps) {
  const groupedObservations = useMemo(() => {
    const grouped: Record<string, Array<{ date: string; value: number; unit: string }>> = {};
    
    observations.forEach(obs => {
      if (!obs.valueQuantity?.value || !obs.effectiveDateTime) return;
      
      const code = obs.code?.coding?.[0]?.code || "unknown";
      const display = obs.code?.coding?.[0]?.display || obs.code?.text || code;
      const key = `${code}:${display}`;
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        date: obs.effectiveDateTime,
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit || "",
      });
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return grouped;
  }, [observations]);

  const metricOptions = useMemo(() => {
    return Object.keys(groupedObservations).map(key => {
      const [code, display] = key.split(":");
      return { value: key, label: display, code };
    });
  }, [groupedObservations]);

  const activeMetric = selectedMetric || metricOptions[0]?.value;
  const activeData = groupedObservations[activeMetric] || [];
  const [activeCode] = (activeMetric || "").split(":");
  const vitalInfo = VITAL_CATEGORIES[activeCode];

  const chartData = activeData.map(item => ({
    date: format(parseISO(item.date), "MMM d"),
    fullDate: format(parseISO(item.date), "MMM d, yyyy"),
    value: item.value,
    unit: item.unit,
  }));

  const values = activeData.map(d => d.value);
  const trend = getTrend(values);
  const latestValue = values[values.length - 1];
  const isOutOfRange = vitalInfo?.normalRange && latestValue && 
    (latestValue < vitalInfo.normalRange.min || latestValue > vitalInfo.normalRange.max);

  if (metricOptions.length === 0) {
    return (
      <Card data-testid="card-observation-trend-empty">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4" />
            <p>No observation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-observation-trend">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle data-testid="title-observation-trend">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Select value={activeMetric} onValueChange={onMetricChange}>
            <SelectTrigger className="w-[200px]" data-testid="select-metric">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map(option => (
                <SelectItem key={option.value} value={option.value} data-testid={`option-metric-${option.code}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            {vitalInfo && <vitalInfo.icon className="h-5 w-5 text-muted-foreground" />}
            <span className="text-2xl font-bold" data-testid="text-latest-value">
              {latestValue?.toFixed(1)} {activeData[0]?.unit || vitalInfo?.unit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendIcon trend={trend} />
            <span className="text-sm text-muted-foreground capitalize" data-testid="text-trend">{trend}</span>
          </div>
          {isOutOfRange && (
            <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-out-of-range">
              <AlertTriangle className="h-3 w-3" />
              Out of Range
            </Badge>
          )}
        </div>
        
        <div className="h-64" data-testid="chart-observation-trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelFormatter={(label) => chartData.find(d => d.date === label)?.fullDate || label}
                formatter={(value: number) => [
                  `${value.toFixed(1)} ${activeData[0]?.unit || vitalInfo?.unit || ''}`,
                  metricOptions.find(m => m.value === activeMetric)?.label
                ]}
              />
              {vitalInfo?.normalRange && (
                <>
                  <ReferenceLine y={vitalInfo.normalRange.min} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  <ReferenceLine y={vitalInfo.normalRange.max} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                </>
              )}
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface VitalSignsGridProps {
  observations: FhirObservation[];
}

export function VitalSignsGrid({ observations }: VitalSignsGridProps) {
  const latestVitals = useMemo(() => {
    const vitals: Record<string, { value: number; unit: string; date: string; trend: "up" | "down" | "stable"; history: number[] }> = {};
    
    const grouped: Record<string, Array<{ date: string; value: number; unit: string }>> = {};
    observations.forEach(obs => {
      if (!obs.valueQuantity?.value || !obs.effectiveDateTime) return;
      const code = obs.code?.coding?.[0]?.code || "unknown";
      if (!VITAL_CATEGORIES[code]) return;
      
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push({
        date: obs.effectiveDateTime,
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit || VITAL_CATEGORIES[code].unit,
      });
    });

    Object.entries(grouped).forEach(([code, data]) => {
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latest = data[0];
      const history = data.slice(0, 10).map(d => d.value).reverse();
      vitals[code] = {
        value: latest.value,
        unit: latest.unit,
        date: latest.date,
        trend: getTrend(history),
        history,
      };
    });

    return vitals;
  }, [observations]);

  if (Object.keys(latestVitals).length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="grid-vital-signs">
      {Object.entries(VITAL_CATEGORIES).map(([code, info]) => {
        const vital = latestVitals[code];
        if (!vital) return null;
        
        const normalRange = info.normalRange;
        const isOutOfRange = normalRange && (vital.value < normalRange.min || vital.value > normalRange.max);
        
        return (
          <Card key={code} className={isOutOfRange ? "border-destructive" : ""} data-testid={`card-vital-${code}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <info.icon className="h-4 w-4 text-muted-foreground" />
                <TrendIcon trend={vital.trend} />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold" data-testid={`value-vital-${code}`}>
                  {vital.value.toFixed(1)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{vital.unit}</span>
                </p>
                <p className="text-sm text-muted-foreground" data-testid={`label-vital-${code}`}>{info.label}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(vital.date), "MMM d, yyyy")}
                </p>
              </div>
              {isOutOfRange && (
                <Badge variant="destructive" className="mt-2 text-xs" data-testid={`badge-alert-${code}`}>
                  Out of normal range
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface MedicationAdherenceChartProps {
  medicationRequests: FhirMedicationRequest[];
  medicationStatements: FhirMedicationStatement[];
  title?: string;
  description?: string;
}

export function MedicationAdherenceChart({ 
  medicationRequests, 
  medicationStatements,
  title = "Medication Adherence",
  description = "Estimated medication patterns based on prescription and statement records"
}: MedicationAdherenceChartProps) {
  const adherenceData = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    const medsByMonth = months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const activeRequests = medicationRequests.filter(req => {
        if (!req.authoredOn) return false;
        const date = parseISO(req.authoredOn);
        return date <= monthEnd && req.status === "active";
      });

      const statements = medicationStatements.filter(stmt => {
        const date = stmt.effectiveDateTime ? parseISO(stmt.effectiveDateTime) : 
                     stmt.effectivePeriod?.start ? parseISO(stmt.effectivePeriod.start) : null;
        if (!date) return false;
        return date >= monthStart && date <= monthEnd;
      });

      const expectedDoses = activeRequests.length * 30;
      const recordedDoses = statements.length;
      const adherenceRate = expectedDoses > 0 ? Math.min((recordedDoses / expectedDoses) * 100, 100) : 0;

      return {
        month: format(month, "MMM"),
        fullMonth: format(month, "MMMM yyyy"),
        expected: activeRequests.length,
        recorded: statements.length,
        adherenceRate: Math.round(adherenceRate),
      };
    });

    return medsByMonth;
  }, [medicationRequests, medicationStatements]);

  const medicationStatus = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    medicationRequests.forEach(req => {
      const status = req.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [medicationRequests]);

  const activeMedications = useMemo(() => {
    return medicationRequests.filter(req => req.status === "active").map(req => ({
      name: req.medicationCodeableConcept?.text || 
            req.medicationCodeableConcept?.coding?.[0]?.display || 
            "Unknown Medication",
      dosage: req.dosageInstruction?.[0]?.text || "As directed",
      startDate: req.authoredOn ? format(parseISO(req.authoredOn), "MMM d, yyyy") : "Unknown",
    }));
  }, [medicationRequests]);

  if (medicationRequests.length === 0 && medicationStatements.length === 0) {
    return (
      <Card data-testid="card-medication-adherence-empty">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Pill className="h-12 w-12 mb-4" />
            <p>No medication data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-medication-adherence">
      <CardHeader>
        <CardTitle data-testid="title-medication-adherence">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList data-testid="tabs-medication">
            <TabsTrigger value="trend" data-testid="tab-medication-trend">Adherence Trend</TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-medication-status">Status Overview</TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-medication-list">Active Medications</TabsTrigger>
          </TabsList>

          <TabsContent value="trend">
            <div className="h-64" data-testid="chart-medication-trend">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adherenceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label) => adherenceData.find(d => d.month === label)?.fullMonth || label}
                    formatter={(value: number) => [`${value}%`, "Adherence Rate"]}
                  />
                  <Bar dataKey="adherenceRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <ReferenceLine y={80} stroke="hsl(var(--chart-2))" strokeDasharray="5 5" label={{ value: "Target 80%", fill: 'hsl(var(--muted-foreground))' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="status">
            <div className="h-64 flex items-center justify-center" data-testid="chart-medication-status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={medicationStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {medicationStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-3 max-h-64 overflow-y-auto" data-testid="list-active-medications">
              {activeMedications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active medications</p>
              ) : (
                activeMedications.map((med, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`item-medication-${index}`}>
                    <div className="flex items-center gap-3">
                      <Pill className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium" data-testid={`text-medication-name-${index}`}>{med.name}</p>
                        <p className="text-sm text-muted-foreground">{med.dosage}</p>
                      </div>
                    </div>
                    <Badge variant="outline" data-testid={`badge-medication-date-${index}`}>{med.startDate}</Badge>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface EncounterHistoryChartProps {
  encounters: FhirEncounter[];
  title?: string;
  description?: string;
}

export function EncounterHistoryChart({ 
  encounters,
  title = "Encounter History",
  description = "View your healthcare visits over time"
}: EncounterHistoryChartProps) {
  const encountersByMonth = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: now });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthEncounters = encounters.filter(enc => {
        const date = enc.period?.start ? parseISO(enc.period.start) : null;
        if (!date) return false;
        return date >= monthStart && date <= monthEnd;
      });

      const byType: Record<string, number> = {};
      monthEncounters.forEach(enc => {
        const type = enc.class?.display || enc.class?.code || "Other";
        byType[type] = (byType[type] || 0) + 1;
      });

      return {
        month: format(month, "MMM"),
        fullMonth: format(month, "MMMM yyyy"),
        total: monthEncounters.length,
        ...byType,
      };
    });
  }, [encounters]);

  const encounterTypes = useMemo(() => {
    const types: Record<string, number> = {};
    encounters.forEach(enc => {
      const type = enc.class?.display || enc.class?.code || "Other";
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [encounters]);

  const recentEncounters = useMemo(() => {
    return encounters
      .filter(enc => enc.period?.start)
      .sort((a, b) => new Date(b.period!.start!).getTime() - new Date(a.period!.start!).getTime())
      .slice(0, 10)
      .map(enc => ({
        id: enc.id,
        type: enc.class?.display || enc.class?.code || "Visit",
        date: enc.period?.start ? format(parseISO(enc.period.start), "MMM d, yyyy") : "Unknown",
        reason: enc.reasonCode?.[0]?.text || enc.reasonCode?.[0]?.coding?.[0]?.display || "General Visit",
        provider: enc.serviceProvider?.display || "Healthcare Provider",
        status: enc.status,
        duration: enc.period?.start && enc.period?.end 
          ? differenceInDays(parseISO(enc.period.end), parseISO(enc.period.start))
          : null,
      }));
  }, [encounters]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    encounters.forEach(enc => {
      types.add(enc.class?.display || enc.class?.code || "Other");
    });
    return Array.from(types);
  }, [encounters]);

  if (encounters.length === 0) {
    return (
      <Card data-testid="card-encounter-history-empty">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4" />
            <p>No encounter data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-encounter-history">
      <CardHeader>
        <CardTitle data-testid="title-encounter-history">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList data-testid="tabs-encounter">
            <TabsTrigger value="timeline" data-testid="tab-encounter-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="types" data-testid="tab-encounter-types">By Type</TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-encounter-list">Recent Visits</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <div className="h-64" data-testid="chart-encounter-timeline">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={encountersByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label) => encountersByMonth.find(d => d.month === label)?.fullMonth || label}
                  />
                  <Legend />
                  {uniqueTypes.map((type, index) => (
                    <Bar 
                      key={type} 
                      dataKey={type} 
                      stackId="a" 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      radius={index === uniqueTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="types">
            <div className="h-64 flex items-center justify-center" data-testid="chart-encounter-types">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={encounterTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {encounterTypes.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-3 max-h-64 overflow-y-auto" data-testid="list-recent-encounters">
              {recentEncounters.map((enc) => (
                <div key={enc.id} className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-lg" data-testid={`item-encounter-${enc.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-accent rounded-lg">
                      {enc.type.toLowerCase().includes("inpatient") ? (
                        <Building className="h-4 w-4 text-accent-foreground" />
                      ) : (
                        <Stethoscope className="h-4 w-4 text-accent-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium" data-testid={`text-encounter-type-${enc.id}`}>{enc.type}</p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-encounter-reason-${enc.id}`}>{enc.reason}</p>
                      <p className="text-xs text-muted-foreground">{enc.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={enc.status === "finished" ? "secondary" : "outline"} data-testid={`badge-encounter-status-${enc.id}`}>
                      {enc.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-encounter-date-${enc.id}`}>{enc.date}</p>
                    {enc.duration !== null && enc.duration > 0 && (
                      <p className="text-xs text-muted-foreground">{enc.duration} day{enc.duration > 1 ? "s" : ""}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface LabResultsChartProps {
  observations: FhirObservation[];
  title?: string;
  description?: string;
}

export function LabResultsChart({ 
  observations,
  title = "Lab Results Trends",
  description = "Monitor your laboratory test results over time"
}: LabResultsChartProps) {
  const labObservations = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(c => c.code === "laboratory")
      )
    );
  }, [observations]);

  const groupedLabs = useMemo(() => {
    const grouped: Record<string, Array<{ date: string; value: number; unit: string }>> = {};
    
    labObservations.forEach(obs => {
      if (!obs.valueQuantity?.value || !obs.effectiveDateTime) return;
      
      const name = obs.code?.text || obs.code?.coding?.[0]?.display || "Unknown Test";
      
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push({
        date: obs.effectiveDateTime,
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit || "",
      });
    });

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return grouped;
  }, [labObservations]);

  const labNames = Object.keys(groupedLabs);

  if (labNames.length === 0) {
    return (
      <Card data-testid="card-lab-results-empty">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Droplet className="h-12 w-12 mb-4" />
            <p>No laboratory data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-lab-results">
      <CardHeader>
        <CardTitle data-testid="title-lab-results">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={labNames[0]} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1" data-testid="tabs-lab-tests">
            {labNames.slice(0, 5).map(name => (
              <TabsTrigger key={name} value={name} className="text-xs" data-testid={`tab-lab-${name.replace(/\s+/g, '-').toLowerCase()}`}>
                {name}
              </TabsTrigger>
            ))}
          </TabsList>

          {labNames.slice(0, 5).map(name => {
            const data = groupedLabs[name];
            const chartData = data.map(item => ({
              date: format(parseISO(item.date), "MMM d"),
              fullDate: format(parseISO(item.date), "MMM d, yyyy"),
              value: item.value,
              unit: item.unit,
            }));
            const values = data.map(d => d.value);
            const trend = getTrend(values);
            const latestValue = values[values.length - 1];

            return (
              <TabsContent key={name} value={name}>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-2xl font-bold" data-testid={`text-lab-value-${name.replace(/\s+/g, '-').toLowerCase()}`}>
                    {latestValue?.toFixed(2)} {data[0]?.unit}
                  </span>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={trend} />
                    <span className="text-sm text-muted-foreground capitalize">{trend}</span>
                  </div>
                </div>
                <div className="h-48" data-testid={`chart-lab-${name.replace(/\s+/g, '-').toLowerCase()}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(label) => chartData.find(d => d.date === label)?.fullDate || label}
                        formatter={(value: number) => [`${value.toFixed(2)} ${data[0]?.unit}`, name]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
