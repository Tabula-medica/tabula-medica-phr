import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Heart,
  Pill,
  TestTube2,
  FileText,
  Download,
  Info,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Award,
  Sparkles,
  Share2,
} from "lucide-react";
import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";

type TimePeriod = "7d" | "30d" | "90d" | "6m" | "1y";

interface MedicationAdherence {
  medication: string;
  prescribed: number;
  taken: number;
  adherenceRate: number;
  missedDoses: number;
  streak: number;
}

interface LabTrend {
  date: string;
  value: number;
  status: "normal" | "high" | "low" | "critical";
}

interface TreatmentEvent {
  id: string;
  date: string;
  type: "appointment" | "procedure" | "lab" | "medication" | "diagnosis";
  title: string;
  provider?: string;
  outcome?: string;
  notes?: string;
}

interface HealthPacketSummary {
  type: "emergency" | "cancer" | "visit";
  lastGenerated: string;
  itemCount: number;
  downloadCount: number;
}

function generateMedicationAdherence(): MedicationAdherence[] {
  return [
    { medication: "Metformin 500mg", prescribed: 60, taken: 57, adherenceRate: 95, missedDoses: 3, streak: 14 },
    { medication: "Lisinopril 10mg", prescribed: 30, taken: 28, adherenceRate: 93, missedDoses: 2, streak: 7 },
    { medication: "Atorvastatin 20mg", prescribed: 30, taken: 30, adherenceRate: 100, missedDoses: 0, streak: 30 },
    { medication: "Aspirin 81mg", prescribed: 30, taken: 25, adherenceRate: 83, missedDoses: 5, streak: 3 },
  ];
}

function generateLabTrends(testName: string, days: number): LabTrend[] {
  const configs: Record<string, { base: number; variance: number; min: number; max: number }> = {
    "HbA1c": { base: 6.5, variance: 0.8, min: 4.0, max: 5.7 },
    "Glucose": { base: 110, variance: 30, min: 70, max: 100 },
    "LDL": { base: 115, variance: 20, min: 0, max: 100 },
    "Blood Pressure": { base: 128, variance: 15, min: 90, max: 120 },
    "Weight": { base: 175, variance: 5, min: 150, max: 180 },
  };
  
  const config = configs[testName] || { base: 100, variance: 10, min: 80, max: 120 };
  const data: LabTrend[] = [];
  const now = new Date();
  const interval = Math.max(7, Math.floor(days / 10));
  
  for (let i = days; i >= 0; i -= interval) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = Math.round((config.base + (Math.random() - 0.5) * config.variance) * 10) / 10;
    
    let status: LabTrend["status"] = "normal";
    if (value > config.max * 1.2 || value < config.min * 0.8) status = "critical";
    else if (value > config.max) status = "high";
    else if (value < config.min) status = "low";
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value,
      status,
    });
  }
  return data;
}

function generateTreatmentTimeline(): TreatmentEvent[] {
  return [
    { id: "1", date: "2026-01-20", type: "appointment", title: "Annual Physical", provider: "Dr. Smith", outcome: "Healthy", notes: "Blood pressure slightly elevated" },
    { id: "2", date: "2026-01-15", type: "lab", title: "Comprehensive Metabolic Panel", provider: "Quest Diagnostics", outcome: "Normal", notes: "All values within range" },
    { id: "3", date: "2026-01-10", type: "medication", title: "Started Metformin", provider: "Dr. Johnson", notes: "500mg twice daily for pre-diabetes" },
    { id: "4", date: "2026-01-05", type: "diagnosis", title: "Pre-diabetes Diagnosis", provider: "Dr. Johnson", notes: "HbA1c at 6.2%" },
    { id: "5", date: "2025-12-20", type: "procedure", title: "Flu Vaccination", provider: "CVS Pharmacy", outcome: "Completed" },
    { id: "6", date: "2025-12-15", type: "appointment", title: "Cardiology Follow-up", provider: "Dr. Williams", outcome: "Stable" },
    { id: "7", date: "2025-12-01", type: "lab", title: "Lipid Panel", provider: "LabCorp", outcome: "Borderline High LDL" },
    { id: "8", date: "2025-11-15", type: "appointment", title: "Eye Exam", provider: "Dr. Lee", outcome: "No changes" },
  ];
}

function generateHealthPackets(): HealthPacketSummary[] {
  return [
    { type: "emergency", lastGenerated: "2026-01-18", itemCount: 12, downloadCount: 3 },
    { type: "cancer", lastGenerated: "2026-01-10", itemCount: 25, downloadCount: 1 },
    { type: "visit", lastGenerated: "2026-01-15", itemCount: 8, downloadCount: 2 },
  ];
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

function TrendBadge({ trend, isGoodUp = true }: { trend: "up" | "down" | "stable"; isGoodUp?: boolean }) {
  const isGood = trend === "stable" || (isGoodUp ? trend === "up" : trend === "down");
  const config = {
    up: { icon: TrendingUp, text: "Improving" },
    down: { icon: TrendingDown, text: "Declining" },
    stable: { icon: Minus, text: "Stable" },
  };
  const Icon = config[trend].icon;
  return (
    <Badge variant="outline" className={isGood ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {config[trend].text}
    </Badge>
  );
}

const ADHERENCE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];
const EVENT_COLORS: Record<string, string> = {
  appointment: "#3b82f6",
  procedure: "#8b5cf6",
  lab: "#22c55e",
  medication: "#ec4899",
  diagnosis: "#f59e0b",
};

export default function MyHealthDashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [selectedLabTest, setSelectedLabTest] = useState("HbA1c");
  
  const periodDays: Record<TimePeriod, number> = {
    "7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365,
  };
  
  const periodLabels: Record<TimePeriod, string> = {
    "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months", "1y": "Last year",
  };

  const medicationData = generateMedicationAdherence();
  const labData = generateLabTrends(selectedLabTest, periodDays[timePeriod]);
  const timeline = generateTreatmentTimeline();
  const packets = generateHealthPackets();
  
  const overallAdherence = Math.round(medicationData.reduce((sum, m) => sum + m.adherenceRate, 0) / medicationData.length);
  const labTrend = getTrend(labData.map(d => d.value));

  const handleExportAll = () => {
    const csvContent = [
      ["Category", "Item", "Value", "Date"],
      ...medicationData.map(m => ["Medication", m.medication, `${m.adherenceRate}%`, new Date().toISOString().split("T")[0]]),
      ...labData.map(l => ["Lab Result", selectedLabTest, l.value.toString(), l.date]),
      ...timeline.map(t => ["Treatment Event", t.title, t.outcome || "", t.date]),
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-health-data-${timePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4 justify-between flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild data-testid="button-back">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                My Health Dashboard
              </h1>
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
            
            <Button variant="outline" onClick={handleExportAll} className="min-h-[44px]" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto p-4 space-y-6">
        <GuardrailsDisclaimer variant="inline" />

        <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Preview Mode:</strong> This dashboard shows sample health data for illustration. 
            Connect your health records to see your actual data.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-adherence-score">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Medication Adherence</span>
                </div>
                <Badge variant={overallAdherence >= 90 ? "default" : "secondary"}>
                  {overallAdherence >= 90 ? "Excellent" : overallAdherence >= 80 ? "Good" : "Needs Attention"}
                </Badge>
              </div>
              <div className="text-3xl font-bold mt-2">{overallAdherence}%</div>
              <Progress value={overallAdherence} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-streak">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-muted-foreground">Longest Streak</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {Math.max(...medicationData.map(m => m.streak))} <span className="text-sm font-normal">days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Atorvastatin 20mg</p>
            </CardContent>
          </Card>

          <Card data-testid="card-appointments">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Appointments</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {timeline.filter(t => t.type === "appointment").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">in {periodLabels[timePeriod].toLowerCase()}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-labs">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">Lab Tests</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {timeline.filter(t => t.type === "lab").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">completed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="adherence">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="adherence" className="min-h-[44px]" data-testid="tab-adherence">
              <Pill className="h-4 w-4 mr-2" />
              Adherence
            </TabsTrigger>
            <TabsTrigger value="labs" className="min-h-[44px]" data-testid="tab-labs">
              <TestTube2 className="h-4 w-4 mr-2" />
              Lab Trends
            </TabsTrigger>
            <TabsTrigger value="timeline" className="min-h-[44px]" data-testid="tab-timeline">
              <Activity className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="packets" className="min-h-[44px]" data-testid="tab-packets">
              <FileText className="h-4 w-4 mr-2" />
              Packets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="adherence" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Medication Adherence by Drug</CardTitle>
                  <CardDescription>Percentage of prescribed doses taken</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={medicationData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'currentColor' }} />
                        <YAxis type="category" dataKey="medication" width={120} tick={{ fill: 'currentColor', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                          formatter={(value: number) => [`${value}%`, 'Adherence']}
                        />
                        <ReferenceLine x={80} stroke="#f59e0b" strokeDasharray="3 3" />
                        <Bar dataKey="adherenceRate" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adherence Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {medicationData.map((med, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1">
                            <div className="font-medium">{med.medication}</div>
                            <div className="text-sm text-muted-foreground">
                              {med.taken}/{med.prescribed} doses taken
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge variant={med.adherenceRate >= 90 ? "default" : med.adherenceRate >= 80 ? "secondary" : "destructive"}>
                                {med.adherenceRate}%
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {med.streak} day streak
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="labs" className="space-y-4 mt-4">
            <div className="flex items-center gap-4 mb-4">
              <Select value={selectedLabTest} onValueChange={setSelectedLabTest}>
                <SelectTrigger className="w-[200px] min-h-[44px]" data-testid="select-lab-test">
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HbA1c">HbA1c</SelectItem>
                  <SelectItem value="Glucose">Fasting Glucose</SelectItem>
                  <SelectItem value="LDL">LDL Cholesterol</SelectItem>
                  <SelectItem value="Blood Pressure">Blood Pressure</SelectItem>
                  <SelectItem value="Weight">Weight</SelectItem>
                </SelectContent>
              </Select>
              <TrendBadge trend={labTrend} isGoodUp={selectedLabTest === "Weight" ? false : labTrend === "down"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube2 className="h-5 w-5 text-purple-500" />
                  {selectedLabTest} Trend
                </CardTitle>
                <CardDescription>Your lab results over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={labData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fill: 'currentColor' }} />
                      <YAxis tick={{ fill: 'currentColor' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                        formatter={(value: number, name: string, props: any) => {
                          const status = props.payload?.status || 'unknown';
                          const statusLabels: Record<string, string> = { normal: 'Normal range', high: 'Above normal', low: 'Below normal', critical: 'Critical' };
                          return [`${value} (${statusLabels[status] || status})`, selectedLabTest];
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8b5cf6" 
                        fill="#8b5cf6" 
                        fillOpacity={0.2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const colors: Record<string, string> = { normal: "#22c55e", high: "#f59e0b", low: "#3b82f6", critical: "#ef4444" };
                          return <circle cx={cx} cy={cy} r={5} fill={colors[payload.status]} stroke="white" strokeWidth={2} />;
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
                      <Badge variant={result.status === "normal" ? "outline" : "destructive"}>
                        {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold mt-2">{result.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Treatment Timeline
                </CardTitle>
                <CardDescription>Your health events and treatments</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {timeline.map((event) => (
                      <div key={event.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0 w-20 text-sm text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <div 
                          className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" 
                          style={{ backgroundColor: EVENT_COLORS[event.type] }}
                          role="img"
                          aria-label={`${event.type} event indicator`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{event.type}</Badge>
                            <span className="font-medium">{event.title}</span>
                          </div>
                          {event.provider && (
                            <p className="text-sm text-muted-foreground mt-1">Provider: {event.provider}</p>
                          )}
                          {event.outcome && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Outcome:</span> {event.outcome}
                            </p>
                          )}
                          {event.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packets" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {packets.map((packet) => (
                <Card key={packet.type} className="hover-elevate">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 capitalize">
                      <FileText className="h-5 w-5 text-primary" />
                      {packet.type} Packet
                    </CardTitle>
                    <CardDescription>
                      Last generated: {new Date(packet.lastGenerated).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Items included</span>
                        <span className="font-medium">{packet.itemCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Times downloaded</span>
                        <span className="font-medium">{packet.downloadCount}</span>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" className="flex-1 min-h-[44px]" asChild>
                          <Link href="/packet-export">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                          <Share2 className="h-4 w-4" />
                          <span className="sr-only">Share</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Health packets compile your medical information into shareable PDFs. 
                Emergency packets include allergies, medications, and diagnoses. 
                Cancer packets include treatment timelines and survivorship plans.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
