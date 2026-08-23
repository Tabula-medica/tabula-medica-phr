import { useState, useEffect } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Pill,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Bell,
  Plus,
  RefreshCw,
  Loader2,
  Flame,
  Target,
  BarChart3,
  LineChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PATIENT_ID = "patient-1";

interface MedicationReminder {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  isActive: boolean;
}

interface AdherenceStats {
  medicationId: string;
  medicationName: string;
  totalDoses: number;
  takenOnTime: number;
  takenLate: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
  streakDays: number;
  longestStreak: number;
  lastTaken?: string;
}

interface NonAdherenceFlag {
  id: string;
  medicationName: string;
  flagType: string;
  severity: string;
  description: string;
  detectedAt: string;
  status: string;
}

const COLORS = {
  taken: "#10b981",
  late: "#f59e0b",
  skipped: "#ef4444",
  missed: "#6b7280",
};

export default function MedicationAdherence() {
  const { toast } = useToast();
  const [selectedMedication, setSelectedMedication] = useState<string | null>(null);
  const [showAddReminder, setShowAddReminder] = useState(false);

  useEffect(() => {
    fetch(`/api/medication-adherence/initialize/${PATIENT_ID}`, { method: "POST" });
  }, []);

  const { data: remindersData, isLoading: remindersLoading } = useQuery({
    queryKey: ["/api/medication-adherence/reminders", PATIENT_ID],
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/medication-adherence/stats", PATIENT_ID],
  });

  const { data: dailyData } = useQuery({
    queryKey: ["/api/medication-adherence/daily", PATIENT_ID],
  });

  const { data: overallData } = useQuery({
    queryKey: ["/api/medication-adherence/overall", PATIENT_ID],
  });

  const { data: todayData } = useQuery({
    queryKey: ["/api/medication-adherence/today", PATIENT_ID],
  });

  const { data: flagsData } = useQuery({
    queryKey: ["/api/medication-adherence/flags", PATIENT_ID],
  });

  const logAdherenceMutation = useMutation({
    mutationFn: async ({ medicationId, reminderId, status }: { medicationId: string; reminderId: string; status: string }) => {
      const res = await fetch(`/api/medication-adherence/logs/${PATIENT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId,
          reminderId,
          scheduledTime: new Date().toISOString(),
          actualTime: new Date().toISOString(),
          status,
        }),
      });
      if (!res.ok) throw new Error("Failed to log adherence");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-adherence"] });
      toast({ title: "Logged successfully", description: "Your medication has been recorded" });
    },
  });

  const reminders = ((remindersData as any)?.data || []) as MedicationReminder[];
  const stats = ((statsData as any)?.data || []) as AdherenceStats[];
  const daily = ((dailyData as any)?.data || []) as { date: string; taken: number; missed: number; rate: number }[];
  const overall = (overallData as any)?.data?.adherenceRate || 0;
  const today = (todayData as any)?.data || { upcoming: [], taken: [], pending: [] };
  const flags = ((flagsData as any)?.data || []) as NonAdherenceFlag[];

  const pendingFlags = flags.filter(f => f.status === "pending");

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return "text-green-500";
    if (rate >= 75) return "text-yellow-500";
    return "text-red-500";
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="destructive" className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  if (remindersLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Medication Adherence</h1>
          <p className="text-muted-foreground">Track your medication schedule and build healthy habits</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showAddReminder} onOpenChange={setShowAddReminder}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-reminder">
                <Plus className="w-4 h-4 mr-2" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Medication Reminder</DialogTitle>
                <DialogDescription>Set up a new medication reminder</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="medication-adherence-medication-name">Medication Name</Label>
                  <Input id="medication-adherence-medication-name" placeholder="Enter medication name" data-testid="input-med-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medication-adherence-dosage">Dosage</Label>
                  <Input id="medication-adherence-dosage" placeholder="e.g., 10mg" data-testid="input-dosage" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medication-adherence-frequency">Frequency</Label>
                  <Select>
                    <SelectTrigger id="medication-adherence-frequency" data-testid="select-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once_daily">Once Daily</SelectItem>
                      <SelectItem value="twice_daily">Twice Daily</SelectItem>
                      <SelectItem value="three_times_daily">Three Times Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="as_needed">As Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddReminder(false)}>Cancel</Button>
                <Button onClick={() => setShowAddReminder(false)}>Save Reminder</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pendingFlags.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Attention Needed</AlertTitle>
          <AlertDescription>
            You have {pendingFlags.length} medication adherence {pendingFlags.length === 1 ? "alert" : "alerts"} that need review.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${overall >= 90 ? "bg-green-500/10" : overall >= 75 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                <Target className={`w-6 h-6 ${getAdherenceColor(overall)}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Adherence</p>
                <p className={`text-3xl font-bold ${getAdherenceColor(overall)}`} data-testid="text-overall-rate">
                  {overall}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Pill className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Medications</p>
                <p className="text-3xl font-bold" data-testid="text-active-meds">
                  {reminders.filter(r => r.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Best Streak</p>
                <p className="text-3xl font-bold" data-testid="text-best-streak">
                  {Math.max(...stats.map(s => s.longestStreak), 0)} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Bell className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Progress</p>
                <p className="text-3xl font-bold" data-testid="text-today-progress">
                  {today.taken.length}/{today.taken.length + today.pending.length + today.upcoming.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today" data-testid="tab-today">
            <Clock className="w-4 h-4 mr-2" />
            Today
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <LineChart className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="w-4 h-4 mr-2" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts {pendingFlags.length > 0 && <Badge variant="destructive" className="ml-2">{pendingFlags.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Today's Medications</CardTitle>
                <CardDescription>Track your medications for today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {today.pending.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-red-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Needs Attention
                    </h4>
                    {today.pending.map((reminder: MedicationReminder) => (
                      <div key={reminder.id} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-center gap-3">
                          <Pill className="w-5 h-5 text-red-500" />
                          <div>
                            <p className="font-medium">{reminder.medicationName}</p>
                            <p className="text-sm text-muted-foreground">{reminder.dosage}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => logAdherenceMutation.mutate({ 
                              medicationId: reminder.medicationId, 
                              reminderId: reminder.id,
                              status: "skipped" 
                            })}
                            data-testid={`button-skip-${reminder.id}`}
                          >
                            Skip
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => logAdherenceMutation.mutate({ 
                              medicationId: reminder.medicationId, 
                              reminderId: reminder.id,
                              status: "late" 
                            })}
                            data-testid={`button-take-${reminder.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Take Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {today.upcoming.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-blue-500 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Upcoming
                    </h4>
                    {today.upcoming.map((reminder: MedicationReminder) => (
                      <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Pill className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{reminder.medicationName}</p>
                            <p className="text-sm text-muted-foreground">{reminder.dosage} - {reminder.scheduledTimes.join(", ")}</p>
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => logAdherenceMutation.mutate({ 
                            medicationId: reminder.medicationId, 
                            reminderId: reminder.id,
                            status: "taken" 
                          })}
                          data-testid={`button-take-upcoming-${reminder.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Take
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {today.taken.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-green-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                    </h4>
                    {today.taken.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="font-medium">{log.medicationId}</p>
                            <p className="text-sm text-muted-foreground">
                              Taken at {new Date(log.actualTime).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-500 border-green-500">Done</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {today.pending.length === 0 && today.upcoming.length === 0 && today.taken.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No medications scheduled for today</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Overview</CardTitle>
                <CardDescription>Your adherence for the past 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={daily.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { weekday: "short" })} 
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Legend />
                    <Bar dataKey="taken" name="Taken" fill={COLORS.taken} stackId="a" />
                    <Bar dataKey="missed" name="Missed" fill={COLORS.missed} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>30-Day Adherence Trend</CardTitle>
                <CardDescription>Your daily adherence rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} 
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      formatter={(value) => [`${value}%`, "Adherence"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Area type="monotone" dataKey="rate" stroke="#10b981" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Medication Performance</CardTitle>
                <CardDescription>Adherence by medication</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="medicationName" type="category" width={100} />
                    <Tooltip 
                      formatter={(value) => [`${value}%`, "Adherence"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Bar dataKey="adherenceRate" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {stats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.adherenceRate >= 90 ? "#10b981" : entry.adherenceRate >= 75 ? "#f59e0b" : "#ef4444"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dose Breakdown</CardTitle>
              <CardDescription>Status distribution over the past 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats.length > 0 && (
                  <>
                    <div className="p-4 bg-green-500/10 rounded-lg text-center">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p className="text-2xl font-bold text-green-500">
                        {stats.reduce((s, m) => s + m.takenOnTime, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Taken On Time</p>
                    </div>
                    <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-2xl font-bold text-yellow-500">
                        {stats.reduce((s, m) => s + m.takenLate, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Taken Late</p>
                    </div>
                    <div className="p-4 bg-orange-500/10 rounded-lg text-center">
                      <XCircle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                      <p className="text-2xl font-bold text-orange-500">
                        {stats.reduce((s, m) => s + m.skipped, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                    </div>
                    <div className="p-4 bg-red-500/10 rounded-lg text-center">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                      <p className="text-2xl font-bold text-red-500">
                        {stats.reduce((s, m) => s + m.missed, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Missed</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <div className="grid gap-4">
            {stats.map((med) => (
              <Card key={med.medicationId}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${med.adherenceRate >= 90 ? "bg-green-500/10" : med.adherenceRate >= 75 ? "bg-yellow-500/10" : "bg-red-500/10"}`}>
                        <Pill className={`w-6 h-6 ${getAdherenceColor(med.adherenceRate)}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{med.medicationName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {med.totalDoses} doses tracked
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${getAdherenceColor(med.adherenceRate)}`}>
                          {med.adherenceRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">Adherence</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-500">{med.streakDays}</p>
                        <p className="text-xs text-muted-foreground">Current Streak</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{med.longestStreak}</p>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                      </div>
                    </div>

                    <div className="w-48">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Adherence</span>
                        <span>{med.adherenceRate}%</span>
                      </div>
                      <Progress value={med.adherenceRate} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {pendingFlags.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <h3 className="font-semibold text-lg">No Alerts</h3>
                  <p className="text-muted-foreground">You're doing great with your medication schedule!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingFlags.map((flag) => (
                <Card key={flag.id} className={`border-l-4 ${
                  flag.severity === "critical" ? "border-l-red-500" : 
                  flag.severity === "high" ? "border-l-orange-500" : 
                  "border-l-yellow-500"
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          flag.severity === "critical" ? "text-red-500" : 
                          flag.severity === "high" ? "text-orange-500" : 
                          "text-yellow-500"
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{flag.medicationName}</h4>
                            {getSeverityBadge(flag.severity)}
                          </div>
                          <p className="text-sm text-muted-foreground">{flag.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Detected: {new Date(flag.detectedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-review-${flag.id}`}>
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-medication-adherence-disclaimer" />
    </div>
  );
}