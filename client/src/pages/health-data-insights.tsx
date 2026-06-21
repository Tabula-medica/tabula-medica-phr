import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
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
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  TestTube2,
  Pill,
  FileText,
  Download,
  Info,
  AlertTriangle,
} from "lucide-react";
import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";

type TimePeriod = "7d" | "30d" | "90d" | "6m" | "1y";

interface VitalDataPoint {
  date: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number;
  oxygenSat?: number;
  weight?: number;
}

interface LabDataPoint {
  date: string;
  value: number;
  unit: string;
  status: "normal" | "high" | "low" | "critical";
  referenceMin?: number;
  referenceMax?: number;
}

interface SymptomDataPoint {
  date: string;
  severity: number;
  type: string;
}

function generateVitalData(days: number): VitalDataPoint[] {
  const data: VitalDataPoint[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i -= Math.max(1, Math.floor(days / 30))) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      systolic: Math.round(115 + Math.random() * 20),
      diastolic: Math.round(70 + Math.random() * 15),
      heartRate: Math.round(65 + Math.random() * 20),
      temperature: Math.round((97.5 + Math.random() * 1.5) * 10) / 10,
      oxygenSat: Math.round(95 + Math.random() * 4),
      weight: Math.round((170 + Math.random() * 5) * 10) / 10,
    });
  }
  
  return data;
}

function generateLabData(testName: string, days: number): LabDataPoint[] {
  const configs: Record<string, { baseValue: number; unit: string; min: number; max: number }> = {
    "HbA1c": { baseValue: 6.2, unit: "%", min: 4.0, max: 5.7 },
    "Glucose": { baseValue: 105, unit: "mg/dL", min: 70, max: 100 },
    "Cholesterol": { baseValue: 195, unit: "mg/dL", min: 0, max: 200 },
    "HDL": { baseValue: 55, unit: "mg/dL", min: 40, max: 100 },
    "LDL": { baseValue: 120, unit: "mg/dL", min: 0, max: 100 },
    "Creatinine": { baseValue: 1.0, unit: "mg/dL", min: 0.7, max: 1.3 },
    "TSH": { baseValue: 2.5, unit: "mIU/L", min: 0.4, max: 4.0 },
  };
  
  const config = configs[testName] || { baseValue: 100, unit: "units", min: 80, max: 120 };
  const data: LabDataPoint[] = [];
  const now = new Date();
  const interval = Math.max(30, Math.floor(days / 6));
  
  for (let i = days; i >= 0; i -= interval) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const variance = (config.max - config.min) * 0.3;
    const value = Math.round((config.baseValue + (Math.random() - 0.5) * variance) * 10) / 10;
    
    let status: LabDataPoint["status"] = "normal";
    if (value > config.max * 1.2 || value < config.min * 0.8) status = "critical";
    else if (value > config.max || value < config.min) status = value > config.max ? "high" : "low";
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value,
      unit: config.unit,
      status,
      referenceMin: config.min,
      referenceMax: config.max,
    });
  }
  
  return data;
}

function generateSymptomData(days: number): SymptomDataPoint[] {
  const symptoms = ["Fatigue", "Headache", "Nausea", "Pain", "Dizziness"];
  const data: SymptomDataPoint[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i -= Math.max(1, Math.floor(days / 20))) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    if (Math.random() > 0.4) {
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        severity: Math.round(1 + Math.random() * 9),
        type: symptoms[Math.floor(Math.random() * symptoms.length)],
      });
    }
  }
  
  return data;
}

function getTrend(data: number[]): "up" | "down" | "stable" {
  if (data.length < 2) return "stable";
  const recent = data.slice(-3);
  const earlier = data.slice(0, 3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (Math.abs(diff) < earlierAvg * 0.05) return "stable";
  return diff > 0 ? "up" : "down";
}

function TrendBadge({ trend, label }: { trend: "up" | "down" | "stable"; label?: string }) {
  const config = {
    up: { icon: TrendingUp, className: "text-amber-600 dark:text-amber-400", text: "Trending Up" },
    down: { icon: TrendingDown, className: "text-blue-600 dark:text-blue-400", text: "Trending Down" },
    stable: { icon: Minus, className: "text-green-600 dark:text-green-400", text: "Stable" },
  };
  const Icon = config[trend].icon;
  return (
    <Badge variant="outline" className={config[trend].className}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {label || config[trend].text}
    </Badge>
  );
}

export default function HealthDataInsightsPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [selectedLabTest, setSelectedLabTest] = useState("HbA1c");
  
  const periodDays: Record<TimePeriod, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 180,
    "1y": 365,
  };
  
  const periodLabels: Record<TimePeriod, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "6m": "Last 6 months",
    "1y": "Last year",
  };

  const vitalData = generateVitalData(periodDays[timePeriod]);
  const labData = generateLabData(selectedLabTest, periodDays[timePeriod]);
  const symptomData = generateSymptomData(periodDays[timePeriod]);
  
  const bpTrend = getTrend(vitalData.map(d => d.systolic || 0));
  const hrTrend = getTrend(vitalData.map(d => d.heartRate || 0));
  const labTrend = getTrend(labData.map(d => d.value));

  const handleExport = () => {
    const csvContent = [
      ["Date", "Systolic", "Diastolic", "Heart Rate", "Temperature", "Oxygen Sat", "Weight"],
      ...vitalData.map(d => [
        d.date,
        d.systolic || "",
        d.diastolic || "",
        d.heartRate || "",
        d.temperature || "",
        d.oxygenSat || "",
        d.weight || "",
      ]),
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-data-${timePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              asChild
              data-testid="button-back"
            >
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Health Data Insights</h1>
              <p className="text-sm text-muted-foreground">{periodLabels[timePeriod]}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[140px] min-h-[44px]" data-testid="select-time-period">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              onClick={handleExport}
              className="min-h-[44px]"
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto p-4 space-y-6">
        <GuardrailsDisclaimer variant="inline" />

        <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Preview Mode:</strong> This visualization shows sample health data for illustrative purposes. 
            Connect your health records via Fasten Health to see your actual data.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="vitals">
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="vitals" className="min-h-[44px]" data-testid="tab-vitals">
              <Activity className="h-4 w-4 mr-2" />
              Vitals
            </TabsTrigger>
            <TabsTrigger value="labs" className="min-h-[44px]" data-testid="tab-labs">
              <TestTube2 className="h-4 w-4 mr-2" />
              Labs
            </TabsTrigger>
            <TabsTrigger value="symptoms" className="min-h-[44px]" data-testid="tab-symptoms">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Symptoms
            </TabsTrigger>
            <TabsTrigger value="timeline" className="min-h-[44px]" data-testid="tab-timeline">
              <FileText className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vitals" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="col-span-full lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Blood Pressure
                    </CardTitle>
                    <TrendBadge trend={bpTrend} />
                  </div>
                  <CardDescription>Systolic and diastolic pressure over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={vitalData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[60, 160]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                        />
                        <Legend />
                        <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "High", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="systolic" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Systolic" />
                        <Area type="monotone" dataKey="diastolic" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Diastolic" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-5 w-5 text-pink-500" />
                      Heart Rate
                    </CardTitle>
                    <TrendBadge trend={hrTrend} />
                  </div>
                  <CardDescription>Beats per minute</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[50, 100]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value} bpm`, 'Heart Rate']}
                        />
                        <Line type="monotone" dataKey="heartRate" stroke="#ec4899" strokeWidth={2} dot={true} name="Heart Rate" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    Oxygen Saturation
                  </CardTitle>
                  <CardDescription>SpO2 percentage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={vitalData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[90, 100]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value}%`, 'SpO2']}
                        />
                        <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="oxygenSat" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="SpO2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-orange-500" />
                    Temperature
                  </CardTitle>
                  <CardDescription>Body temperature (°F)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={[96, 100]} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value}°F`, 'Temperature']}
                        />
                        <ReferenceLine y={98.6} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Normal", position: "insideTopRight", fill: "#22c55e", fontSize: 10 }} />
                        <Line type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={true} name="Temperature" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weight Trend</CardTitle>
                  <CardDescription>Body weight over time (lbs)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={vitalData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} className="text-xs" tick={{ fill: 'currentColor' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value} lbs`, 'Weight']}
                        />
                        <Area type="monotone" dataKey="weight" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="Weight" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="labs" className="space-y-4 mt-4">
            <div className="flex items-center gap-4 mb-4">
              <Select value={selectedLabTest} onValueChange={setSelectedLabTest}>
                <SelectTrigger className="w-[180px] min-h-[44px]" data-testid="select-lab-test">
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HbA1c">HbA1c</SelectItem>
                  <SelectItem value="Glucose">Glucose</SelectItem>
                  <SelectItem value="Cholesterol">Total Cholesterol</SelectItem>
                  <SelectItem value="HDL">HDL Cholesterol</SelectItem>
                  <SelectItem value="LDL">LDL Cholesterol</SelectItem>
                  <SelectItem value="Creatinine">Creatinine</SelectItem>
                  <SelectItem value="TSH">TSH</SelectItem>
                </SelectContent>
              </Select>
              <TrendBadge trend={labTrend} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube2 className="h-5 w-5 text-purple-500" />
                  {selectedLabTest} Results Over Time
                </CardTitle>
                <CardDescription>
                  Reference range: {labData[0]?.referenceMin} - {labData[0]?.referenceMax} {labData[0]?.unit}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={labData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                      <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `${value} ${props.payload.unit}`,
                          selectedLabTest
                        ]}
                      />
                      {labData[0]?.referenceMax && (
                        <ReferenceLine y={labData[0].referenceMax} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "High", position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />
                      )}
                      {labData[0]?.referenceMin && (
                        <ReferenceLine y={labData[0].referenceMin} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: "Low", position: "insideBottomRight", fill: "#3b82f6", fontSize: 10 }} />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8b5cf6" 
                        fill="#8b5cf6" 
                        fillOpacity={0.2} 
                        name={selectedLabTest}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const colors: Record<string, string> = {
                            normal: "#22c55e",
                            high: "#f59e0b",
                            low: "#3b82f6",
                            critical: "#ef4444",
                          };
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill={colors[payload.status] || "#8b5cf6"}
                              stroke="white"
                              strokeWidth={2}
                            />
                          );
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              {labData.slice(-3).reverse().map((result, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{result.date}</span>
                      <Badge 
                        variant={result.status === "normal" ? "outline" : "destructive"}
                        className={result.status === "normal" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                      >
                        {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold mt-2">
                      {result.value} <span className="text-sm font-normal text-muted-foreground">{result.unit}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="symptoms" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Symptom Severity Over Time
                </CardTitle>
                <CardDescription>Reported symptoms and their intensity (1-10 scale)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={symptomData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                      <YAxis domain={[0, 10]} className="text-xs" tick={{ fill: 'currentColor' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `Severity: ${value}/10`,
                          props.payload.type
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Bar 
                        dataKey="severity" 
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                        name="Severity"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Most Common Symptoms</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {["Fatigue", "Headache", "Pain", "Nausea", "Dizziness"].map((symptom) => {
                      const count = symptomData.filter(s => s.type === symptom).length;
                      const avgSeverity = symptomData.filter(s => s.type === symptom).reduce((a, b) => a + b.severity, 0) / (count || 1);
                      return (
                        <div key={symptom} className="flex items-center justify-between">
                          <span>{symptom}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{count} occurrences</Badge>
                            <Badge variant={avgSeverity > 5 ? "destructive" : "secondary"}>
                              Avg: {avgSeverity.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Symptom Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This visualization shows reported symptoms over the selected time period. 
                      Discuss any patterns or concerns with your healthcare provider.
                    </AlertDescription>
                  </Alert>
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>Total symptoms logged: {symptomData.length}</p>
                    <p>Average severity: {(symptomData.reduce((a, b) => a + b.severity, 0) / (symptomData.length || 1)).toFixed(1)}/10</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Treatment Timeline
                </CardTitle>
                <CardDescription>Key health events and treatments over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { date: "Jan 15, 2026", event: "Annual Physical Exam", type: "visit", provider: "Dr. Smith" },
                    { date: "Jan 10, 2026", event: "Lab Results: HbA1c 6.2%", type: "lab", status: "normal" },
                    { date: "Jan 5, 2026", event: "Started Metformin 500mg", type: "medication" },
                    { date: "Dec 28, 2025", event: "Cardiology Consultation", type: "visit", provider: "Dr. Johnson" },
                    { date: "Dec 20, 2025", event: "ECG Test - Normal Sinus Rhythm", type: "procedure" },
                    { date: "Dec 15, 2025", event: "Blood Pressure Follow-up", type: "visit", provider: "Dr. Smith" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="w-24 flex-shrink-0 text-sm text-muted-foreground">{item.date}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{item.type}</Badge>
                          <span className="font-medium">{item.event}</span>
                        </div>
                        {item.provider && (
                          <p className="text-sm text-muted-foreground mt-1">Provider: {item.provider}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-data-insights-disclaimer" />
    </div>
  );
}