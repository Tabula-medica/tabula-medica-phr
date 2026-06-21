import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Activity, Flame, Footprints, Timer, Heart, Plus, TrendingUp, Dumbbell, Bike, PersonStanding, Waves, Target, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, LineChart, Line } from "recharts";
type ExerciseIntensity = "light" | "moderate" | "vigorous" | "maximum";
type ExerciseType = "cardio" | "strength" | "flexibility" | "balance" | "sports" | "walking" | "running" | "cycling" | "swimming" | "yoga" | "other";

interface ExerciseRecord {
  id: string;
  patientId: string;
  date: string;
  startTime: string;
  endTime?: string;
  exerciseType: ExerciseType;
  activityName: string;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  caloriesBurned?: number;
  distance?: number;
  distanceUnit?: "miles" | "km" | "meters";
  steps?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  sets?: {
    exercise: string;
    reps: number;
    weight?: number;
    weightUnit?: "lbs" | "kg";
  }[];
  notes?: string;
  feelingRating?: number;
  source: "manual" | "device";
  createdAt: string;
  updatedAt: string;
}

const mockExerciseData: ExerciseRecord[] = [
  {
    id: "1",
    patientId: "patient-1",
    date: "2026-01-18",
    startTime: "06:30",
    endTime: "07:15",
    exerciseType: "running",
    activityName: "Morning Run",
    durationMinutes: 45,
    intensity: "moderate",
    caloriesBurned: 420,
    distance: 4.2,
    distanceUnit: "miles",
    steps: 6800,
    averageHeartRate: 145,
    maxHeartRate: 168,
    feelingRating: 4,
    source: "device",
    createdAt: "2026-01-18T07:15:00Z",
    updatedAt: "2026-01-18T07:15:00Z",
  },
  {
    id: "2",
    patientId: "patient-1",
    date: "2026-01-17",
    startTime: "18:00",
    endTime: "19:00",
    exerciseType: "strength",
    activityName: "Upper Body Workout",
    durationMinutes: 60,
    intensity: "vigorous",
    caloriesBurned: 380,
    sets: [
      { exercise: "Bench Press", reps: 10, weight: 135, weightUnit: "lbs" },
      { exercise: "Shoulder Press", reps: 12, weight: 45, weightUnit: "lbs" },
      { exercise: "Bent Over Rows", reps: 10, weight: 95, weightUnit: "lbs" },
      { exercise: "Bicep Curls", reps: 12, weight: 30, weightUnit: "lbs" },
    ],
    averageHeartRate: 125,
    maxHeartRate: 148,
    feelingRating: 5,
    source: "manual",
    createdAt: "2026-01-17T19:00:00Z",
    updatedAt: "2026-01-17T19:00:00Z",
  },
  {
    id: "3",
    patientId: "patient-1",
    date: "2026-01-16",
    startTime: "07:00",
    endTime: "07:45",
    exerciseType: "cycling",
    activityName: "Indoor Cycling",
    durationMinutes: 45,
    intensity: "vigorous",
    caloriesBurned: 520,
    distance: 14.5,
    distanceUnit: "miles",
    averageHeartRate: 152,
    maxHeartRate: 172,
    feelingRating: 4,
    source: "device",
    createdAt: "2026-01-16T07:45:00Z",
    updatedAt: "2026-01-16T07:45:00Z",
  },
  {
    id: "4",
    patientId: "patient-1",
    date: "2026-01-15",
    startTime: "17:30",
    endTime: "18:15",
    exerciseType: "yoga",
    activityName: "Vinyasa Flow",
    durationMinutes: 45,
    intensity: "light",
    caloriesBurned: 180,
    averageHeartRate: 95,
    maxHeartRate: 110,
    feelingRating: 5,
    source: "manual",
    createdAt: "2026-01-15T18:15:00Z",
    updatedAt: "2026-01-15T18:15:00Z",
  },
];

const weeklyActivityData = [
  { day: "Mon", minutes: 45, calories: 380 },
  { day: "Tue", minutes: 60, calories: 520 },
  { day: "Wed", minutes: 30, calories: 240 },
  { day: "Thu", minutes: 0, calories: 0 },
  { day: "Fri", minutes: 45, calories: 420 },
  { day: "Sat", minutes: 75, calories: 650 },
  { day: "Sun", minutes: 45, calories: 380 },
];

const heartRateTrend = [
  { time: "6:30", rate: 72 },
  { time: "6:35", rate: 95 },
  { time: "6:40", rate: 125 },
  { time: "6:45", rate: 148 },
  { time: "6:50", rate: 156 },
  { time: "6:55", rate: 162 },
  { time: "7:00", rate: 168 },
  { time: "7:05", rate: 158 },
  { time: "7:10", rate: 145 },
  { time: "7:15", rate: 98 },
];

function getExerciseIcon(type: ExerciseType) {
  switch (type) {
    case "running":
      return <PersonStanding className="h-5 w-5 text-green-500" />;
    case "cycling":
      return <Bike className="h-5 w-5 text-blue-500" />;
    case "strength":
      return <Dumbbell className="h-5 w-5 text-purple-500" />;
    case "swimming":
      return <Waves className="h-5 w-5 text-cyan-500" />;
    case "yoga":
      return <Activity className="h-5 w-5 text-pink-500" />;
    default:
      return <Activity className="h-5 w-5 text-orange-500" />;
  }
}

function getIntensityBadge(intensity: ExerciseIntensity) {
  const config: Record<ExerciseIntensity, { color: string; label: string }> = {
    light: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100", label: "Light" },
    moderate: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100", label: "Moderate" },
    vigorous: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100", label: "Vigorous" },
    maximum: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", label: "Maximum" },
  };
  const { color, label } = config[intensity];
  return <Badge className={color}>{label}</Badge>;
}

export default function ExerciseTrackingPage() {
  const [selectedTab, setSelectedTab] = useState("overview");
  
  const weeklyTotals = {
    minutes: weeklyActivityData.reduce((sum, d) => sum + d.minutes, 0),
    calories: weeklyActivityData.reduce((sum, d) => sum + d.calories, 0),
    workouts: mockExerciseData.length,
  };
  
  const weeklyGoal = 150;
  const goalProgress = (weeklyTotals.minutes / weeklyGoal) * 100;

  const todaySteps = 8542;
  const stepsGoal = 10000;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-exercise">Exercise & Activity</h1>
          <p className="text-muted-foreground">Track workouts and monitor your fitness progress</p>
        </div>
        <Button data-testid="button-log-workout">
          <Plus className="h-4 w-4 mr-2" />
          Log Workout
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Minutes</CardTitle>
            <Timer className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyTotals.minutes}</div>
            <Progress value={goalProgress} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {weeklyGoal} min goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Calories Burned</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyTotals.calories.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Today's Steps</CardTitle>
            <Footprints className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaySteps.toLocaleString()}</div>
            <Progress value={(todaySteps / stepsGoal) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {stepsGoal.toLocaleString()} goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Workouts</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyTotals.workouts}</div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="workouts" data-testid="tab-workouts">Workouts</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Activity</CardTitle>
                <CardDescription>Active minutes per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyActivityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Minutes" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Latest Workout Heart Rate</CardTitle>
                <CardDescription>Morning Run - Jan 18</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={heartRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" className="text-xs" />
                    <YAxis domain={[60, 180]} className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="rate" stroke="#ef4444" fill="#ef444420" name="Heart Rate (bpm)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg HR</p>
                    <p className="font-bold text-red-500">145 bpm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Max HR</p>
                    <p className="font-bold text-red-600">168 bpm</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Zone</p>
                    <p className="font-bold text-orange-500">Cardio</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Workouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockExerciseData.slice(0, 3).map((workout) => (
                  <div key={workout.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
                    <div className="flex items-center gap-3">
                      {getExerciseIcon(workout.exerciseType)}
                      <div>
                        <p className="font-medium">{workout.activityName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(workout.date), "MMM d")} • {workout.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-500">{workout.caloriesBurned} cal</p>
                      {getIntensityBadge(workout.intensity)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Workouts</CardTitle>
              <CardDescription>Your complete workout history</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {mockExerciseData.map((workout) => (
                    <Card key={workout.id} className="hover-elevate" data-testid={`card-workout-${workout.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                              {getExerciseIcon(workout.exerciseType)}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{workout.activityName}</span>
                                {getIntensityBadge(workout.intensity)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(workout.date), "EEEE, MMM d")} • {workout.startTime} - {workout.endTime}
                              </p>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span><Timer className="inline h-3 w-3 mr-1" />{workout.durationMinutes} min</span>
                                {workout.distance && (
                                  <span>{workout.distance} {workout.distanceUnit}</span>
                                )}
                                {workout.steps && (
                                  <span><Footprints className="inline h-3 w-3 mr-1" />{workout.steps.toLocaleString()}</span>
                                )}
                              </div>
                              {workout.sets && (
                                <div className="mt-2 space-y-1">
                                  {workout.sets.map((set, idx) => (
                                    <p key={idx} className="text-xs text-muted-foreground">
                                      {set.exercise}: {set.reps} reps @ {set.weight} {set.weightUnit}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-xl font-bold text-orange-500">{workout.caloriesBurned}</div>
                            <p className="text-xs text-muted-foreground">calories</p>
                            {workout.averageHeartRate && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Heart className="h-3 w-3 text-red-500" />
                                {workout.averageHeartRate} avg
                              </div>
                            )}
                            {workout.feelingRating && (
                              <div className="flex justify-end">
                                {Array.from({ length: workout.feelingRating }).map((_, i) => (
                                  <span key={i} className="text-yellow-500">★</span>
                                ))}
                              </div>
                            )}
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

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calories Burned Trend</CardTitle>
              <CardDescription>Weekly calorie expenditure from exercise</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weeklyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Area type="monotone" dataKey="calories" stroke="#f97316" fill="#f9731620" name="Calories" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-green-600">6</div>
                  <p className="text-sm text-muted-foreground mt-1">Days in a row</p>
                  <p className="text-xs text-muted-foreground mt-2">Best streak: 14 days</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-blue-600">{Math.round(goalProgress)}%</div>
                  <p className="text-sm text-muted-foreground mt-1">{weeklyTotals.minutes} of {weeklyGoal} minutes</p>
                  <Progress value={goalProgress} className="mt-3 h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fitness Insights</CardTitle>
              <CardDescription>AI-powered analysis of your exercise patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Activity Consistency</p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      Your activity log shows 6 active days in the last 7 days. Fitness research states that consistent activity refers to a key factor in building lasting habits.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <Heart className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-400">Heart Rate Zone Data</p>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                      Your data shows significant time in the cardio zone (70-85% max HR). Exercise science states that Zone 2 training refers to endurance-focused activity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900">
                <div className="flex items-start gap-3">
                  <Dumbbell className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-700 dark:text-purple-400">Training Balance</p>
                    <p className="text-sm text-purple-600/80 dark:text-purple-400/80 mt-1">
                      Your workout log shows a mix of cardio and strength training this week. Fitness guidelines state that balanced training refers to an approach that supports overall fitness.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
