import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Moon, Sun, Clock, TrendingUp, TrendingDown, Zap, AlertCircle, Plus, Calendar, BarChart3 } from "lucide-react";
import { format, differenceInHours, differenceInMinutes, parseISO } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
type SleepQuality = "excellent" | "good" | "fair" | "poor" | "very_poor";
type SleepStage = "awake" | "light" | "deep" | "rem";

interface SleepRecord {
  id: string;
  patientId: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalSleepMinutes: number;
  sleepQuality: SleepQuality;
  sleepScore?: number;
  stages?: {
    stage: SleepStage;
    durationMinutes: number;
    percentage: number;
  }[];
  interruptions: number;
  source: "manual" | "device";
  createdAt: string;
  updatedAt: string;
}

const mockSleepData: SleepRecord[] = [
  {
    id: "1",
    patientId: "patient-1",
    date: "2026-01-18",
    bedtime: "23:15",
    wakeTime: "07:00",
    totalSleepMinutes: 435,
    sleepQuality: "good",
    sleepScore: 82,
    stages: [
      { stage: "awake", durationMinutes: 30, percentage: 7 },
      { stage: "light", durationMinutes: 195, percentage: 45 },
      { stage: "deep", durationMinutes: 105, percentage: 24 },
      { stage: "rem", durationMinutes: 105, percentage: 24 },
    ],
    interruptions: 1,
    source: "device",
    createdAt: "2026-01-18T07:00:00Z",
    updatedAt: "2026-01-18T07:00:00Z",
  },
  {
    id: "2",
    patientId: "patient-1",
    date: "2026-01-17",
    bedtime: "23:45",
    wakeTime: "06:30",
    totalSleepMinutes: 385,
    sleepQuality: "fair",
    sleepScore: 68,
    stages: [
      { stage: "awake", durationMinutes: 50, percentage: 13 },
      { stage: "light", durationMinutes: 180, percentage: 47 },
      { stage: "deep", durationMinutes: 80, percentage: 21 },
      { stage: "rem", durationMinutes: 75, percentage: 19 },
    ],
    interruptions: 3,
    source: "device",
    createdAt: "2026-01-17T06:30:00Z",
    updatedAt: "2026-01-17T06:30:00Z",
  },
  {
    id: "3",
    patientId: "patient-1",
    date: "2026-01-16",
    bedtime: "22:30",
    wakeTime: "06:45",
    totalSleepMinutes: 475,
    sleepQuality: "excellent",
    sleepScore: 91,
    stages: [
      { stage: "awake", durationMinutes: 20, percentage: 4 },
      { stage: "light", durationMinutes: 200, percentage: 42 },
      { stage: "deep", durationMinutes: 130, percentage: 27 },
      { stage: "rem", durationMinutes: 125, percentage: 27 },
    ],
    interruptions: 0,
    source: "device",
    createdAt: "2026-01-16T06:45:00Z",
    updatedAt: "2026-01-16T06:45:00Z",
  },
];

const weeklyTrendData = [
  { day: "Mon", hours: 7.2, score: 75 },
  { day: "Tue", hours: 6.8, score: 68 },
  { day: "Wed", hours: 7.9, score: 91 },
  { day: "Thu", hours: 6.4, score: 62 },
  { day: "Fri", hours: 7.5, score: 80 },
  { day: "Sat", hours: 8.2, score: 88 },
  { day: "Sun", hours: 7.3, score: 82 },
];

const stageColors: Record<string, string> = {
  awake: "#f97316",
  light: "#60a5fa",
  deep: "#3b82f6",
  rem: "#8b5cf6",
};

function getQualityBadge(quality: SleepQuality) {
  const config: Record<SleepQuality, { color: string; label: string }> = {
    excellent: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100", label: "Excellent" },
    good: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100", label: "Good" },
    fair: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100", label: "Fair" },
    poor: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100", label: "Poor" },
    very_poor: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", label: "Very Poor" },
  };
  const { color, label } = config[quality];
  return <Badge className={color}>{label}</Badge>;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function SleepTrackingPage() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const latestSleep = mockSleepData[0];

  const avgSleepHours = weeklyTrendData.reduce((sum, d) => sum + d.hours, 0) / weeklyTrendData.length;
  const avgScore = Math.round(weeklyTrendData.reduce((sum, d) => sum + d.score, 0) / weeklyTrendData.length);
  const sleepGoal = 8;
  const goalProgress = Math.min((avgSleepHours / sleepGoal) * 100, 100);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-sleep-tracking">Sleep Tracking</h1>
          <p className="text-muted-foreground">Monitor your sleep patterns and improve rest quality</p>
        </div>
        <Button data-testid="button-log-sleep">
          <Plus className="h-4 w-4 mr-2" />
          Log Sleep
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Last Night</CardTitle>
            <Moon className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(latestSleep.totalSleepMinutes)}</div>
            <div className="flex items-center gap-2 mt-1">
              {getQualityBadge(latestSleep.sleepQuality)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Sleep Score</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestSleep.sleepScore || "--"}</div>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSleepHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Score: {avgScore}/100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Goal Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalProgress.toFixed(0)}%</div>
            <Progress value={goalProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Last Night's Sleep Stages</CardTitle>
                <CardDescription>{format(parseISO(latestSleep.date), "EEEE, MMMM d")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm">{latestSleep.bedtime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">{latestSleep.wakeTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{latestSleep.interruptions} wake-ups</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {latestSleep.stages?.map((stage) => (
                    <div key={stage.stage} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{stage.stage}</span>
                        <span className="text-muted-foreground">{formatDuration(stage.durationMinutes)} ({stage.percentage}%)</span>
                      </div>
                      <Progress 
                        value={stage.percentage} 
                        className="h-2"
                        style={{ backgroundColor: `${stageColors[stage.stage]}20` }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Sleep Duration</CardTitle>
                <CardDescription>Hours of sleep per night</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis domain={[0, 10]} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sleep Score Trend</CardTitle>
              <CardDescription>Your sleep quality over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Area type="monotone" dataKey="score" stroke="#8b5cf6" fill="#8b5cf680" name="Sleep Score" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bedtime Consistency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-3xl font-bold text-green-600">85%</div>
                  <p className="text-sm text-muted-foreground mt-1">Consistent bedtime this week</p>
                  <p className="text-xs text-muted-foreground mt-2">Average bedtime: 11:15 PM</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sleep Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-3xl font-bold text-blue-600">92%</div>
                  <p className="text-sm text-muted-foreground mt-1">Time in bed actually sleeping</p>
                  <p className="text-xs text-muted-foreground mt-2">Target: 85%+</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sleep History</CardTitle>
              <CardDescription>Your recent sleep records</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {mockSleepData.map((record) => (
                    <Card key={record.id} className="hover-elevate" data-testid={`card-sleep-${record.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900">
                              <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                              <p className="font-medium">{format(parseISO(record.date), "EEEE, MMM d")}</p>
                              <p className="text-sm text-muted-foreground">
                                {record.bedtime} - {record.wakeTime} • {record.interruptions} interruptions
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-lg font-bold">{formatDuration(record.totalSleepMinutes)}</div>
                            <div className="flex items-center gap-2 justify-end">
                              {getQualityBadge(record.sleepQuality)}
                              {record.sleepScore && (
                                <Badge variant="outline">{record.sleepScore}/100</Badge>
                              )}
                            </div>
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

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sleep Insights</CardTitle>
              <CardDescription>AI-powered analysis of your sleep patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Deep Sleep Trend</p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      Your data shows a 15% increase in deep sleep this week compared to last week. Research states that deep sleep refers to the stage associated with physical recovery.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">Bedtime Pattern</p>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                      Your records show an average weekday bedtime of 11:30 PM. Sleep research states that earlier bedtimes often correlate with higher sleep scores.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-400">Sleep Cycle Observation</p>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                      Your sleep pattern shows light sleep phases around 6:45 AM. Sleep science states that waking during light sleep refers to a transition that may feel more natural.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-sleep-tracking-disclaimer" />
    </div>
  );
}