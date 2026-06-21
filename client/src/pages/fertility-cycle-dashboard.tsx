import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Baby,
  Bluetooth,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Droplets,
  Eye,
  FlaskConical,
  Heart,
  Info,
  Lightbulb,
  Link2,
  Minus,
  Moon,
  Plus,
  Share2,
  Shield,
  Sparkles,
  Sun,
  Target,
  Thermometer,
  Timer,
  TrendingUp,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const PROFILE_ID = "profile-default";

type FertilityGoal = "conceive" | "avoid" | "track_only";
type HormoneType = "LH" | "E3G" | "PdG" | "FSH";
type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

const PHASE_CONFIG: Record<CyclePhase, { label: string; color: string; icon: typeof Sun; description: string }> = {
  menstrual: { label: "Menstrual", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: Droplets, description: "Period phase — low fertility" },
  follicular: { label: "Follicular", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: TrendingUp, description: "Estrogen rising — building fertility" },
  ovulatory: { label: "Ovulatory", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: Target, description: "Peak fertility window" },
  luteal: { label: "Luteal", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Moon, description: "Post-ovulation — progesterone dominant" },
};

const HORMONE_CONFIG: Record<HormoneType, { label: string; color: string; unit: string; description: string }> = {
  LH: { label: "LH (Luteinizing Hormone)", color: "text-purple-600 dark:text-purple-400", unit: "mIU/mL", description: "Surges 24-36 hours before ovulation" },
  E3G: { label: "E3G (Estrogen Metabolite)", color: "text-pink-600 dark:text-pink-400", unit: "ng/mL", description: "Rises as follicles mature, peaks before ovulation" },
  PdG: { label: "PdG (Progesterone Metabolite)", color: "text-amber-600 dark:text-amber-400", unit: "μg/mL", description: "Rises after ovulation, confirms ovulatory cycle" },
  FSH: { label: "FSH (Follicle Stimulating)", color: "text-blue-600 dark:text-blue-400", unit: "mIU/mL", description: "Stimulates follicle growth early in cycle" },
};

const TREND_ICONS: Record<string, typeof ArrowUp> = { rising: ArrowUp, peak: Zap, falling: ArrowDown, baseline: Minus };

export default function FertilityCycleDashboard() {
  const { toast } = useToast();
  const [showLogHormone, setShowLogHormone] = useState(false);
  const [showStartCycle, setShowStartCycle] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showMiraConnect, setShowMiraConnect] = useState(false);

  const [hormoneForm, setHormoneForm] = useState({ hormoneType: "LH" as HormoneType, value: "", date: new Date().toISOString().split("T")[0], source: "mira" as "mira" | "manual" | "lab", testTime: "", notes: "" });
  const [cycleForm, setCycleForm] = useState({ startDate: new Date().toISOString().split("T")[0], notes: "" });
  const [shareForm, setShareForm] = useState({ providerName: "", providerEmail: "", expiresInDays: 30, permissions: ["cycle_data", "hormone_data", "symptoms"] as string[] });
  const [profileForm, setProfileForm] = useState({ goal: "track_only" as FertilityGoal, age: "", partnerAge: "", monthsTrying: "" });
  const [miraDeviceId, setMiraDeviceId] = useState("");

  const dashboardQuery = useQuery<any>({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
  const dashboard = dashboardQuery.data;

  const logHormoneMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/fertility/hormones/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      setShowLogHormone(false);
      setHormoneForm({ hormoneType: "LH", value: "", date: new Date().toISOString().split("T")[0], source: "mira", testTime: "", notes: "" });
      toast({ title: "Hormone reading logged", description: "Your reading has been recorded." });
    },
  });

  const startCycleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/fertility/cycles/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      setShowStartCycle(false);
      toast({ title: "New cycle started", description: "Cycle tracking is now active." });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/fertility/profile/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      setShowProfileSetup(false);
      toast({ title: "Profile updated" });
    },
  });

  const connectMiraMutation = useMutation({
    mutationFn: (deviceId: string) => apiRequest("POST", `/api/fertility/profile/${PROFILE_ID}/connect-mira`, { deviceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      setShowMiraConnect(false);
      setMiraDeviceId("");
      toast({ title: "MIRA device connected", description: "You can now log hormone readings from your MIRA analyzer." });
    },
  });

  const disconnectMiraMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/fertility/profile/${PROFILE_ID}/disconnect-mira`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      toast({ title: "MIRA device disconnected" });
    },
  });

  const createShareMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/fertility/share/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      setShowShareDialog(false);
      setShareForm({ providerName: "", providerEmail: "", expiresInDays: 30, permissions: ["cycle_data", "hormone_data", "symptoms"] });
      toast({ title: "Share link created", description: "Your provider can now access your cycle data." });
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: (shareId: string) => apiRequest("DELETE", `/api/fertility/share/${PROFILE_ID}/${shareId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fertility/dashboard/${PROFILE_ID}`] });
      toast({ title: "Share link revoked" });
    },
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="fertility-dashboard-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const currentCycle = dashboard?.currentCycle;
  const cycleStats = dashboard?.cycleStats;
  const hormoneOverview = dashboard?.hormoneOverview;
  const insights = dashboard?.insights || [];
  const shares = dashboard?.providerShares || [];
  const profile = dashboard?.profile;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" data-testid="fertility-dashboard">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-page-title">Fertility & Cycle Dashboard</h1>
          <p className="text-muted-foreground mt-1">MIRA-powered hormone tracking with provider sharing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowProfileSetup(true)} data-testid="button-profile-setup">
            <Activity className="h-4 w-4 mr-1" /> Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMiraConnect(true)} data-testid="button-mira-connect">
            <Bluetooth className="h-4 w-4 mr-1" />
            {profile?.miraDeviceConnected ? "MIRA Connected" : "Connect MIRA"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowStartCycle(true)} data-testid="button-start-cycle">
            <Calendar className="h-4 w-4 mr-1" /> New Cycle
          </Button>
          <Button size="sm" onClick={() => setShowLogHormone(true)} data-testid="button-log-hormone">
            <FlaskConical className="h-4 w-4 mr-1" /> Log Hormone
          </Button>
        </div>
      </div>

      {profile?.miraDeviceConnected && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <Bluetooth className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-300">MIRA Analyzer Connected</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            Device ID: {profile.miraDeviceId} — Log hormone readings from your MIRA test wands
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-lg">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="hormones" data-testid="tab-hormones">Hormones</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
          <TabsTrigger value="sharing" data-testid="tab-sharing">Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-current-cycle">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Current Cycle
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentCycle ? (
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary" data-testid="text-cycle-day">Day {currentCycle.cycleDay}</div>
                      <Badge className={`mt-2 ${PHASE_CONFIG[currentCycle.phase as CyclePhase]?.color}`} data-testid="badge-cycle-phase">
                        {PHASE_CONFIG[currentCycle.phase as CyclePhase]?.label || currentCycle.phase}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      {PHASE_CONFIG[currentCycle.phase as CyclePhase]?.description}
                    </p>
                    {currentCycle.fertileWindow?.isActive && (
                      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                        <Target className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700 dark:text-green-300 text-sm font-medium">
                          You are in your fertile window
                        </AlertDescription>
                      </Alert>
                    )}
                    {currentCycle.daysUntilNextPeriod != null && currentCycle.daysUntilNextPeriod > 0 && (
                      <div className="text-sm text-muted-foreground text-center">
                        <Clock className="h-3 w-3 inline mr-1" />
                        ~{currentCycle.daysUntilNextPeriod} days until next period
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground text-sm">No active cycle</p>
                    <Button variant="outline" size="sm" onClick={() => setShowStartCycle(true)} data-testid="button-start-cycle-empty">
                      <Plus className="h-4 w-4 mr-1" /> Start Tracking
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-fertile-window">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" /> Fertile Window
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentCycle?.fertileWindow ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Start</span>
                      <span className="font-medium" data-testid="text-fertile-start">{currentCycle.fertileWindow.start}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">End</span>
                      <span className="font-medium" data-testid="text-fertile-end">{currentCycle.fertileWindow.end}</span>
                    </div>
                    {currentCycle.ovulationEstimate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Est. Ovulation</span>
                        <span className="font-medium" data-testid="text-ovulation-estimate">{currentCycle.ovulationEstimate}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <Badge variant={currentCycle.ovulationConfidence === "confirmed" ? "default" : "secondary"} data-testid="badge-ovulation-confidence">
                        {currentCycle.ovulationConfidence}
                      </Badge>
                    </div>
                    <Progress
                      value={currentCycle.fertileWindow.isActive ? 100 : (currentCycle.cycleDay / 28) * 100}
                      className="h-2"
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">Start a cycle to see your fertile window estimate</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-cycle-stats">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" /> Cycle Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cycleStats ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cycles Tracked</span>
                      <span className="font-medium" data-testid="text-cycles-tracked">{cycleStats.totalCyclesTracked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Length</span>
                      <span className="font-medium">{cycleStats.averageCycleLength} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Luteal Phase</span>
                      <span className="font-medium">{cycleStats.averageLutealPhase} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Ovulation Day</span>
                      <span className="font-medium">Day {cycleStats.averageOvulationDay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Range</span>
                      <span className="font-medium">{cycleStats.shortestCycle || "—"} – {cycleStats.longestCycle || "—"} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regularity</span>
                      <Badge variant={cycleStats.cycleRegularity === "regular" ? "default" : "secondary"} data-testid="badge-regularity">
                        {cycleStats.cycleRegularity === "insufficient_data" ? "More data needed" : cycleStats.cycleRegularity}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No cycle data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-hormone-snapshot">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" /> Hormone Snapshot
              </CardTitle>
              <CardDescription>Latest readings from MIRA analyzer or manual entry</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["LH", "E3G", "PdG"] as HormoneType[]).map((type) => {
                  const data = hormoneOverview?.[`latest${type}`];
                  const config = HORMONE_CONFIG[type];
                  const TrendIcon = data?.trend ? TREND_ICONS[data.trend] || Minus : Minus;
                  return (
                    <div key={type} className="border rounded-lg p-4 space-y-2" data-testid={`card-hormone-${type.toLowerCase()}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${config.color}`}>{type}</span>
                        {data?.trend && (
                          <Badge variant="outline" className="text-xs">
                            <TrendIcon className="h-3 w-3 mr-1" /> {data.trend}
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold">
                        {data?.value != null ? `${data.value} ${config.unit}` : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                      {data?.date && (
                        <p className="text-xs text-muted-foreground">Last: {data.date}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {hormoneOverview?.ovulationConfirmedByPdG && (
                <Alert className="mt-4 border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-300">Ovulation Confirmed</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-400 text-sm">
                    PdG levels confirm ovulation occurred this cycle — a positive indicator of ovulatory function.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {profile?.goal === "conceive" && (
            <Card className="border-pink-200 dark:border-pink-800" data-testid="card-conception-tips">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Baby className="h-5 w-5 text-pink-500" /> Conception Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex gap-3 items-start">
                    <Timer className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Time to Pregnancy</p>
                      <p className="text-muted-foreground">
                        {profile.monthsTrying ? `${profile.monthsTrying} months trying` : "Track months trying in your profile for personalized guidance"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Heart className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Confidence Building</p>
                      <p className="text-muted-foreground">MIRA hormone data gives you objective confirmation of your ovulatory patterns</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Share2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Provider Coaching</p>
                      <p className="text-muted-foreground">Share your cycle data with your RE or OB-GYN for personalized fertility coaching</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Supplements</p>
                      <p className="text-muted-foreground">
                        {profile.supplements?.length ? profile.supplements.join(", ") : "Log supplements in your profile for tracking"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hormones" className="space-y-4">
          <Card data-testid="card-hormone-tracking">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-purple-600" /> Hormone Tracking
                  </CardTitle>
                  <CardDescription>Track LH, E3G (estrogen), and PdG (progesterone) from MIRA or manual entry</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowLogHormone(true)} data-testid="button-log-hormone-tab">
                  <Plus className="h-4 w-4 mr-1" /> Log Reading
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(["LH", "E3G", "PdG"] as HormoneType[]).map((type) => {
                  const config = HORMONE_CONFIG[type];
                  const data = hormoneOverview?.[`latest${type}`];
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
                        {data && (
                          <span className="text-sm font-medium">{data.value} {config.unit}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            type === "LH" ? "bg-purple-500" : type === "E3G" ? "bg-pink-500" : "bg-amber-500"
                          }`}
                          style={{ width: data ? `${Math.min((data.value / (type === "LH" ? 80 : type === "E3G" ? 150 : 15)) * 100, 100)}%` : "0%" }}
                        />
                      </div>
                      {data?.date && (
                        <p className="text-xs text-muted-foreground">Last reading: {data.date} — Trend: {data.trend}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-mira-device">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bluetooth className="h-5 w-5 text-blue-500" /> MIRA Analyzer
              </CardTitle>
              <CardDescription>At-home hormone tracking with clinical-grade accuracy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${profile?.miraDeviceConnected ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-medium">Device Status</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.miraDeviceConnected ? `Connected — ${profile.miraDeviceId}` : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {profile?.miraDeviceConnected ? (
                    <Button variant="outline" size="sm" onClick={() => disconnectMiraMutation.mutate()} data-testid="button-disconnect-mira">
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setShowMiraConnect(true)} data-testid="button-connect-mira-tab">
                      <Bluetooth className="h-4 w-4 mr-1" /> Connect
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">LH + E3G Wand</span>
                    </div>
                    <p className="text-muted-foreground text-xs">Predicts ovulation 24-36h ahead by detecting LH surge and estrogen rise</p>
                  </div>
                  <div className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">PdG (Confirm) Wand</span>
                    </div>
                    <p className="text-muted-foreground text-xs">Confirms ovulation occurred by measuring progesterone metabolite in urine</p>
                  </div>
                  <div className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">FSH Wand</span>
                    </div>
                    <p className="text-muted-foreground text-xs">Measures FSH for ovarian reserve screening — useful for fertility planning</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card data-testid="card-insights">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" /> Personalized Insights
              </CardTitle>
              <CardDescription>AI-generated observations based on your cycle and hormone data</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length > 0 ? (
                <div className="space-y-3">
                  {insights.map((insight: any) => (
                    <div key={insight.id} className="border rounded-lg p-4 space-y-2" data-testid={`card-insight-${insight.type}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {insight.type === "ovulation_prediction" && <Target className="h-4 w-4 text-green-600" />}
                          {insight.type === "hormone_trend" && <TrendingUp className="h-4 w-4 text-purple-600" />}
                          {insight.type === "cycle_pattern" && <Activity className="h-4 w-4 text-blue-600" />}
                          {insight.type === "recommendation" && <Lightbulb className="h-4 w-4 text-yellow-600" />}
                          {insight.type === "fertile_window" && <Heart className="h-4 w-4 text-pink-600" />}
                          <h4 className="font-medium">{insight.title}</h4>
                        </div>
                        <Badge variant="outline" className="text-xs">{Math.round(insight.confidence * 100)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.actionable && insight.action && (
                        <Button variant="outline" size="sm" className="mt-1" data-testid={`button-insight-action-${insight.type}`}>
                          {insight.action}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Insights will appear as you track more cycles and hormone data</p>
                  <p className="text-xs text-muted-foreground">Log hormone readings and complete cycles to unlock personalized observations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharing" className="space-y-4">
          <Card data-testid="card-provider-sharing">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-blue-600" /> Share with Provider
                  </CardTitle>
                  <CardDescription>Generate a secure link to share your fertility data for personalized coaching</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowShareDialog(true)} data-testid="button-create-share">
                  <Link2 className="h-4 w-4 mr-1" /> Create Share Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {shares.length > 0 ? (
                <div className="space-y-3">
                  {shares.map((share: any) => (
                    <div key={share.id} className="border rounded-lg p-4" data-testid={`card-share-${share.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{share.providerName}</span>
                            <Badge variant="outline" className="text-xs">{share.status}</Badge>
                          </div>
                          {share.providerEmail && (
                            <p className="text-sm text-muted-foreground">{share.providerEmail}</p>
                          )}
                          <div className="flex gap-1 flex-wrap mt-1">
                            {share.permissions.map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">{p.replace("_", " ")}</Badge>
                            ))}
                          </div>
                          {share.expiresAt && (
                            <p className="text-xs text-muted-foreground">Expires: {new Date(share.expiresAt).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/fertility-shared/${share.shareToken}`);
                              toast({ title: "Link copied" });
                            }}
                            data-testid={`button-copy-share-${share.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => revokeShareMutation.mutate(share.id)}
                            data-testid={`button-revoke-share-${share.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <Share2 className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No active provider shares</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Share your MIRA hormone data and cycle history with your fertility specialist or OB-GYN for personalized coaching, reduced time to pregnancy, and confidence in your fertility journey.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-benefits">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-pink-500" /> Benefits of Provider Sharing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 space-y-2 text-center">
                  <Target className="h-8 w-8 mx-auto text-green-600" />
                  <h4 className="font-medium">Personalized Coaching</h4>
                  <p className="text-sm text-muted-foreground">Your provider sees your actual hormone levels, not just "positive/negative" — enabling targeted, data-driven fertility guidance</p>
                </div>
                <div className="border rounded-lg p-4 space-y-2 text-center">
                  <Timer className="h-8 w-8 mx-auto text-blue-600" />
                  <h4 className="font-medium">Reduced Time to Pregnancy</h4>
                  <p className="text-sm text-muted-foreground">Quantitative LH, E3G, and PdG data helps identify your exact fertile window and confirm ovulation each cycle</p>
                </div>
                <div className="border rounded-lg p-4 space-y-2 text-center">
                  <Heart className="h-8 w-8 mx-auto text-pink-600" />
                  <h4 className="font-medium">Gaining Confidence</h4>
                  <p className="text-sm text-muted-foreground">Objective hormone data removes guesswork — know that you are ovulating and timing intercourse optimally</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          {dashboard?.disclaimer || "This fertility and cycle tracking information is for personal health awareness only. It does not constitute medical advice or a clinical decision support tool. Always consult your healthcare provider for clinical decisions."}
        </AlertDescription>
      </Alert>

      <Dialog open={showLogHormone} onOpenChange={setShowLogHormone}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Hormone Reading</DialogTitle>
            <DialogDescription>Record a reading from your MIRA analyzer or manual entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Hormone Type</Label>
              <Select value={hormoneForm.hormoneType} onValueChange={(v) => setHormoneForm({ ...hormoneForm, hormoneType: v as HormoneType })}>
                <SelectTrigger data-testid="select-hormone-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LH">LH (Luteinizing Hormone)</SelectItem>
                  <SelectItem value="E3G">E3G (Estrogen Metabolite)</SelectItem>
                  <SelectItem value="PdG">PdG (Progesterone Metabolite)</SelectItem>
                  <SelectItem value="FSH">FSH (Follicle Stimulating Hormone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value ({HORMONE_CONFIG[hormoneForm.hormoneType].unit})</Label>
                <Input type="number" step="0.1" value={hormoneForm.value} onChange={(e) => setHormoneForm({ ...hormoneForm, value: e.target.value })} placeholder="e.g. 25.4" data-testid="input-hormone-value" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={hormoneForm.date} onChange={(e) => setHormoneForm({ ...hormoneForm, date: e.target.value })} data-testid="input-hormone-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={hormoneForm.source} onValueChange={(v) => setHormoneForm({ ...hormoneForm, source: v as any })}>
                <SelectTrigger data-testid="select-hormone-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mira">MIRA Analyzer</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="lab">Lab Result</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Test Time (optional)</Label>
              <Input type="time" value={hormoneForm.testTime} onChange={(e) => setHormoneForm({ ...hormoneForm, testTime: e.target.value })} data-testid="input-hormone-time" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={hormoneForm.notes} onChange={(e) => setHormoneForm({ ...hormoneForm, notes: e.target.value })} placeholder="Any observations..." data-testid="input-hormone-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogHormone(false)}>Cancel</Button>
            <Button
              onClick={() => logHormoneMutation.mutate({
                hormoneType: hormoneForm.hormoneType,
                value: parseFloat(hormoneForm.value),
                date: hormoneForm.date,
                unit: HORMONE_CONFIG[hormoneForm.hormoneType].unit,
                source: hormoneForm.source,
                testTime: hormoneForm.testTime || undefined,
                notes: hormoneForm.notes || undefined,
              })}
              disabled={!hormoneForm.value || logHormoneMutation.isPending}
              data-testid="button-submit-hormone"
            >
              {logHormoneMutation.isPending ? "Saving..." : "Save Reading"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStartCycle} onOpenChange={setShowStartCycle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Cycle</DialogTitle>
            <DialogDescription>Log the first day of your period to start tracking a new cycle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Period Start Date</Label>
              <Input type="date" value={cycleForm.startDate} onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })} data-testid="input-cycle-start" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={cycleForm.notes} onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })} placeholder="Any observations..." data-testid="input-cycle-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartCycle(false)}>Cancel</Button>
            <Button
              onClick={() => startCycleMutation.mutate({
                cycleNumber: (cycleStats?.totalCyclesTracked || 0) + 1,
                startDate: cycleForm.startDate,
                ovulationConfidence: "none",
                bbtReadings: [],
                cervicalMucus: [],
                symptoms: [],
                intercourseLog: [],
                notes: cycleForm.notes || undefined,
              })}
              disabled={startCycleMutation.isPending}
              data-testid="button-submit-cycle"
            >
              {startCycleMutation.isPending ? "Starting..." : "Start Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with Provider</DialogTitle>
            <DialogDescription>Create a secure link to share your cycle and hormone data for fertility coaching</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Name</Label>
              <Input value={shareForm.providerName} onChange={(e) => setShareForm({ ...shareForm, providerName: e.target.value })} placeholder="Dr. Smith" data-testid="input-provider-name" />
            </div>
            <div className="space-y-2">
              <Label>Provider Email (optional)</Label>
              <Input type="email" value={shareForm.providerEmail} onChange={(e) => setShareForm({ ...shareForm, providerEmail: e.target.value })} placeholder="doctor@clinic.com" data-testid="input-provider-email" />
            </div>
            <div className="space-y-2">
              <Label>Link Expires In</Label>
              <Select value={String(shareForm.expiresInDays)} onValueChange={(v) => setShareForm({ ...shareForm, expiresInDays: parseInt(v) })}>
                <SelectTrigger data-testid="select-share-expiry"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data to Share</Label>
              <div className="space-y-2">
                {[
                  { key: "cycle_data", label: "Cycle dates & phases" },
                  { key: "hormone_data", label: "Hormone readings (LH, E3G, PdG)" },
                  { key: "symptoms", label: "Symptoms & observations" },
                  { key: "intercourse_log", label: "Intercourse log" },
                  { key: "notes", label: "Personal notes" },
                ].map((perm) => (
                  <div key={perm.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm-${perm.key}`}
                      checked={shareForm.permissions.includes(perm.key)}
                      onCheckedChange={(checked) => {
                        setShareForm({
                          ...shareForm,
                          permissions: checked ? [...shareForm.permissions, perm.key] : shareForm.permissions.filter(p => p !== perm.key),
                        });
                      }}
                      data-testid={`checkbox-perm-${perm.key}`}
                    />
                    <Label htmlFor={`perm-${perm.key}`} className="text-sm">{perm.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createShareMutation.mutate({
                providerName: shareForm.providerName,
                providerEmail: shareForm.providerEmail || undefined,
                permissions: shareForm.permissions,
                expiresInDays: shareForm.expiresInDays,
              })}
              disabled={!shareForm.providerName || shareForm.permissions.length === 0 || createShareMutation.isPending}
              data-testid="button-submit-share"
            >
              {createShareMutation.isPending ? "Creating..." : "Create Share Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileSetup} onOpenChange={setShowProfileSetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fertility Profile</DialogTitle>
            <DialogDescription>Set your fertility goal and tracking preferences</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fertility Goal</Label>
              <Select value={profileForm.goal} onValueChange={(v) => setProfileForm({ ...profileForm, goal: v as FertilityGoal })}>
                <SelectTrigger data-testid="select-fertility-goal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conceive">Trying to Conceive</SelectItem>
                  <SelectItem value="avoid">Fertility Awareness (Avoid)</SelectItem>
                  <SelectItem value="track_only">Track Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Your Age</Label>
                <Input type="number" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} placeholder="e.g. 32" data-testid="input-age" />
              </div>
              <div className="space-y-2">
                <Label>Partner's Age (optional)</Label>
                <Input type="number" value={profileForm.partnerAge} onChange={(e) => setProfileForm({ ...profileForm, partnerAge: e.target.value })} placeholder="e.g. 34" data-testid="input-partner-age" />
              </div>
            </div>
            {profileForm.goal === "conceive" && (
              <div className="space-y-2">
                <Label>Months Trying to Conceive</Label>
                <Input type="number" value={profileForm.monthsTrying} onChange={(e) => setProfileForm({ ...profileForm, monthsTrying: e.target.value })} placeholder="e.g. 6" data-testid="input-months-trying" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileSetup(false)}>Cancel</Button>
            <Button
              onClick={() => updateProfileMutation.mutate({
                goal: profileForm.goal,
                age: profileForm.age ? parseInt(profileForm.age) : undefined,
                partnerAge: profileForm.partnerAge ? parseInt(profileForm.partnerAge) : undefined,
                monthsTrying: profileForm.monthsTrying ? parseInt(profileForm.monthsTrying) : undefined,
              })}
              disabled={updateProfileMutation.isPending}
              data-testid="button-submit-profile"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMiraConnect} onOpenChange={setShowMiraConnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect MIRA Analyzer</DialogTitle>
            <DialogDescription>Link your MIRA fertility tracking device to log quantitative hormone data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Bluetooth className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Enter the device ID from your MIRA analyzer's settings screen. Once connected, you can log hormone readings directly from your test results.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>MIRA Device ID</Label>
              <Input value={miraDeviceId} onChange={(e) => setMiraDeviceId(e.target.value)} placeholder="e.g. MIRA-A1B2C3D4" data-testid="input-mira-device-id" />
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">How to find your Device ID:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Open your MIRA app</li>
                <li>Go to Settings → Device</li>
                <li>Copy the Device ID shown</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMiraConnect(false)}>Cancel</Button>
            <Button
              onClick={() => connectMiraMutation.mutate(miraDeviceId)}
              disabled={!miraDeviceId || connectMiraMutation.isPending}
              data-testid="button-submit-mira-connect"
            >
              {connectMiraMutation.isPending ? "Connecting..." : "Connect Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
