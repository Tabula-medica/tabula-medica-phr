import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HeartPulse, Thermometer, Activity, Wind, Droplets, Scale, TrendingUp, TrendingDown, Minus, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface VitalReading {
  id: string;
  type: "blood_pressure" | "heart_rate" | "temperature" | "respiratory_rate" | "oxygen_saturation" | "weight";
  value: string;
  unit: string;
  date: string;
  time: string;
  status: "normal" | "elevated" | "low" | "critical";
  source?: string;
}

const mockVitals: VitalReading[] = [
  { id: "1", type: "blood_pressure", value: "128/82", unit: "mmHg", date: "2026-01-18", time: "08:30", status: "elevated", source: "Home Monitor" },
  { id: "2", type: "heart_rate", value: "72", unit: "bpm", date: "2026-01-18", time: "08:30", status: "normal", source: "Home Monitor" },
  { id: "3", type: "oxygen_saturation", value: "98", unit: "%", date: "2026-01-18", time: "08:30", status: "normal", source: "Pulse Oximeter" },
  { id: "4", type: "weight", value: "178.5", unit: "lbs", date: "2026-01-18", time: "07:00", status: "normal", source: "Smart Scale" },
  { id: "5", type: "blood_pressure", value: "125/80", unit: "mmHg", date: "2026-01-17", time: "08:15", status: "normal", source: "Home Monitor" },
  { id: "6", type: "heart_rate", value: "68", unit: "bpm", date: "2026-01-17", time: "08:15", status: "normal", source: "Home Monitor" },
  { id: "7", type: "temperature", value: "98.4", unit: "°F", date: "2026-01-16", time: "09:00", status: "normal", source: "Thermometer" },
  { id: "8", type: "respiratory_rate", value: "16", unit: "breaths/min", date: "2026-01-15", time: "10:00", status: "normal", source: "Clinical Visit" },
  { id: "9", type: "blood_pressure", value: "132/85", unit: "mmHg", date: "2026-01-15", time: "10:00", status: "elevated", source: "Clinical Visit" },
  { id: "10", type: "weight", value: "179.2", unit: "lbs", date: "2026-01-15", time: "07:00", status: "normal", source: "Smart Scale" },
];

const bloodPressureChart = [
  { date: "Jan 12", systolic: 130, diastolic: 84 },
  { date: "Jan 13", systolic: 128, diastolic: 82 },
  { date: "Jan 14", systolic: 126, diastolic: 80 },
  { date: "Jan 15", systolic: 132, diastolic: 85 },
  { date: "Jan 16", systolic: 127, diastolic: 81 },
  { date: "Jan 17", systolic: 125, diastolic: 80 },
  { date: "Jan 18", systolic: 128, diastolic: 82 },
];

const heartRateChart = [
  { date: "Jan 12", rate: 74 },
  { date: "Jan 13", rate: 71 },
  { date: "Jan 14", rate: 76 },
  { date: "Jan 15", rate: 69 },
  { date: "Jan 16", rate: 72 },
  { date: "Jan 17", rate: 68 },
  { date: "Jan 18", rate: 72 },
];

function getVitalIcon(type: VitalReading["type"]) {
  switch (type) {
    case "blood_pressure":
      return <Activity className="h-5 w-5 text-red-500" />;
    case "heart_rate":
      return <HeartPulse className="h-5 w-5 text-pink-500" />;
    case "temperature":
      return <Thermometer className="h-5 w-5 text-orange-500" />;
    case "respiratory_rate":
      return <Wind className="h-5 w-5 text-cyan-500" />;
    case "oxygen_saturation":
      return <Droplets className="h-5 w-5 text-blue-500" />;
    case "weight":
      return <Scale className="h-5 w-5 text-green-500" />;
  }
}

function getVitalLabel(type: VitalReading["type"]) {
  switch (type) {
    case "blood_pressure":
      return "Blood Pressure";
    case "heart_rate":
      return "Heart Rate";
    case "temperature":
      return "Temperature";
    case "respiratory_rate":
      return "Respiratory Rate";
    case "oxygen_saturation":
      return "Oxygen Saturation";
    case "weight":
      return "Weight";
  }
}

function getStatusBadge(status: VitalReading["status"]) {
  switch (status) {
    case "elevated":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Elevated</Badge>;
    case "low":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Low</Badge>;
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    default:
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Normal</Badge>;
  }
}

function getLatestVital(type: VitalReading["type"]) {
  return mockVitals.find(v => v.type === type);
}

export default function VitalsPage() {
  const [selectedTab, setSelectedTab] = useState("overview");

  const latestBP = getLatestVital("blood_pressure");
  const latestHR = getLatestVital("heart_rate");
  const latestO2 = getLatestVital("oxygen_saturation");
  const latestWeight = getLatestVital("weight");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-vitals">Vital Signs</h1>
          <p className="text-muted-foreground">Track and monitor your vital health measurements</p>
        </div>
        <Button data-testid="button-add-vital">
          <Plus className="h-4 w-4 mr-2" />
          Log Vitals
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Blood Pressure</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestBP?.value || "--"}</div>
            <div className="flex items-center gap-2 mt-1">
              {latestBP && getStatusBadge(latestBP.status)}
              <span className="text-xs text-muted-foreground">{latestBP?.unit}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Heart Rate</CardTitle>
            <HeartPulse className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestHR?.value || "--"}</div>
            <div className="flex items-center gap-2 mt-1">
              {latestHR && getStatusBadge(latestHR.status)}
              <span className="text-xs text-muted-foreground">{latestHR?.unit}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Oxygen</CardTitle>
            <Droplets className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestO2?.value || "--"}<span className="text-lg">%</span></div>
            <div className="flex items-center gap-2 mt-1">
              {latestO2 && getStatusBadge(latestO2.status)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Weight</CardTitle>
            <Scale className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestWeight?.value || "--"}</div>
            <div className="flex items-center gap-2 mt-1">
              {latestWeight && getStatusBadge(latestWeight.status)}
              <span className="text-xs text-muted-foreground">{latestWeight?.unit}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Blood Pressure Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bloodPressureChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[60, 150]} className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2} name="Diastolic" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Heart Rate Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={heartRateChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[50, 100]} className="text-xs" />
                    <Tooltip />
                    <Line type="monotone" dataKey="rate" stroke="#ec4899" strokeWidth={2} name="Heart Rate (bpm)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vital Sign Trends</CardTitle>
              <CardDescription>Analyze patterns in your vital measurements over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-red-500" />
                    Blood Pressure
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Your blood pressure readings show a slightly elevated pattern. The average systolic pressure 
                    is 128 mmHg over the past week, which is in the elevated range.
                  </p>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                    Trend: Slightly Elevated
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-pink-500" />
                    Heart Rate
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Your resting heart rate averages 72 bpm, which is within the normal range for adults. 
                    The readings show consistent patterns with no concerning spikes.
                  </p>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    Trend: Stable
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vital History</CardTitle>
              <CardDescription>All recorded vital sign measurements</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {mockVitals.map(vital => (
                    <Card key={vital.id} className="hover-elevate" data-testid={`card-vital-${vital.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {getVitalIcon(vital.type)}
                            <div>
                              <p className="font-medium">{getVitalLabel(vital.type)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(vital.date), "MMM d, yyyy")} at {vital.time}
                                {vital.source && ` • ${vital.source}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold">{vital.value}</span>
                              <span className="text-sm text-muted-foreground">{vital.unit}</span>
                            </div>
                            {getStatusBadge(vital.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-vitals-disclaimer" />
    </div>
  );
}