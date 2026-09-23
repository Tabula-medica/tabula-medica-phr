import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Bone, Brain,
  Contrast, Copy, Dumbbell, Eye, FlaskConical, Heart, HeartPulse, Info,
  Lightbulb, Link2, Minus, Moon, Plus, Share2, Shield, Sparkles, Sun,
  Target, Thermometer, Trash2, TrendingUp, ZoomIn,
} from "lucide-react";

const PROFILE_ID = "profile-default";

type MenoStage = "perimenopause" | "menopause" | "postmenopause";
type MenoHormoneType = "estradiol" | "progesterone" | "testosterone" | "TSH" | "freeT3" | "freeT4";
type BiomarkerType = "boneDensity" | "muscleMass" | "apoB" | "sleepEfficiency";

const HORMONE_CONFIG: Record<MenoHormoneType, { label: string; shortLabel: string; color: string; unit: string; icon: typeof FlaskConical }> = {
  estradiol: { label: "Estradiol (E2)", shortLabel: "E2", color: "text-pink-600 dark:text-pink-400", unit: "pg/mL", icon: FlaskConical },
  progesterone: { label: "Progesterone (P4)", shortLabel: "P4", color: "text-purple-600 dark:text-purple-400", unit: "ng/mL", icon: FlaskConical },
  testosterone: { label: "Testosterone (T)", shortLabel: "T", color: "text-blue-600 dark:text-blue-400", unit: "ng/dL", icon: FlaskConical },
  TSH: { label: "TSH", shortLabel: "TSH", color: "text-teal-600 dark:text-teal-400", unit: "mIU/L", icon: Thermometer },
  freeT3: { label: "Free T3", shortLabel: "fT3", color: "text-orange-600 dark:text-orange-400", unit: "pg/mL", icon: Thermometer },
  freeT4: { label: "Free T4", shortLabel: "fT4", color: "text-amber-600 dark:text-amber-400", unit: "ng/dL", icon: Thermometer },
};

const BIOMARKER_CONFIG: Record<BiomarkerType, { label: string; unit: string; icon: typeof Bone; color: string; description: string }> = {
  boneDensity: { label: "Bone Density", unit: "T-score", icon: Bone, color: "text-stone-600 dark:text-stone-400", description: "DEXA scan T-score measuring bone mineral density" },
  muscleMass: { label: "Muscle Mass", unit: "kg", icon: Dumbbell, color: "text-green-600 dark:text-green-400", description: "Skeletal muscle mass from body composition analysis" },
  apoB: { label: "ApoB", unit: "mg/dL", icon: HeartPulse, color: "text-red-600 dark:text-red-400", description: "Apolipoprotein B — superior cardiovascular risk marker" },
  sleepEfficiency: { label: "Sleep Efficiency", unit: "%", icon: Moon, color: "text-indigo-600 dark:text-indigo-400", description: "Percentage of time in bed actually asleep" },
};

const STATUS_COLORS: Record<string, string> = {
  optimal: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  excellent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  adequate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  borderline: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  fair: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  elevated: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  poor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  no_data: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const TREND_ICONS: Record<string, typeof ArrowUp> = { rising: ArrowUp, declining: ArrowDown, stable: Minus, insufficient_data: Minus };

function ResilienceGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const radius = size === "lg" ? 70 : 40;
  const stroke = size === "lg" ? 12 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const dim = (radius + stroke) * 2;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : score > 0 ? "#ef4444" : "#9ca3af";
  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`Resilience score: ${score} out of 100`}>
      <svg width={dim} height={dim} className="-rotate-90" aria-hidden="true">
        <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/30 dark:text-muted/20" />
        <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${size === "lg" ? "text-3xl" : "text-lg"}`} style={{ color }}>{score || "—"}</span>
        <span className={`text-muted-foreground ${size === "lg" ? "text-xs" : "text-[10px]"}`}>/ 100</span>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300" data-testid="meno-dashboard-loading">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-10 w-96 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:row-span-2 space-y-4 p-6 border rounded-lg bg-card dark:bg-card">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-3 w-56 rounded-sm" />
          <div className="flex justify-center py-4"><Skeleton className="h-40 w-40 rounded-full" /></div>
          <div className="space-y-3">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="lg:col-span-2 p-6 border rounded-lg bg-card dark:bg-card space-y-4">
          <Skeleton className="h-5 w-36 rounded-md" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <Skeleton className="h-3 w-10 rounded-sm" />
                <Skeleton className="h-7 w-20 rounded-md" />
                <Skeleton className="h-2 w-32 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 p-6 border rounded-lg bg-card dark:bg-card space-y-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HighContrastToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onToggle} aria-label={enabled ? "Disable high contrast" : "Enable high contrast"}
      className="h-8 w-8" data-testid="button-high-contrast-toggle" title={enabled ? "Disable high contrast" : "Enable high contrast"}>
      <Contrast className={`h-4 w-4 ${enabled ? "text-yellow-500" : "text-muted-foreground"}`} />
    </Button>
  );
}

export default function MenopauseResilience() {
  const { toast } = useToast();
  const [showLogHormone, setShowLogHormone] = useState(false);
  const [showLogBiomarker, setShowLogBiomarker] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showAddTherapy, setShowAddTherapy] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const [hormoneForm, setHormoneForm] = useState({ hormoneType: "estradiol" as MenoHormoneType, value: "", date: new Date().toISOString().split("T")[0], source: "lab" as "lab" | "manual" | "at_home_kit", labName: "", notes: "" });
  const [biomarkerForm, setBiomarkerForm] = useState({ type: "boneDensity" as BiomarkerType, value: "", date: new Date().toISOString().split("T")[0], source: "lab" as "dexa_scan" | "lab" | "wearable" | "manual", notes: "" });
  const [shareForm, setShareForm] = useState({ providerName: "", providerEmail: "", providerSpecialty: "", expiresInDays: 30, permissions: ["hormones", "biomarkers", "resilience_score", "symptoms", "therapies"] as string[] });
  const [profileForm, setProfileForm] = useState({ stage: "perimenopause" as MenoStage, age: "", lastPeriodDate: "" });
  const [therapyForm, setTherapyForm] = useState({ name: "", type: "HRT" as "HRT" | "supplement" | "medication", dosage: "", route: "", startDate: new Date().toISOString().split("T")[0] });

  const dashQ = useQuery<any>({ queryKey: [`/api/menopause-resilience/dashboard/${PROFILE_ID}`] });
  const d = dashQ.data;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/menopause-resilience/dashboard/${PROFILE_ID}`] });

  const logHormone = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/menopause-resilience/hormones/${PROFILE_ID}`, data),
    onSuccess: () => { invalidate(); setShowLogHormone(false); toast({ title: "Hormone reading saved" }); },
  });
  const logBiomarker = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/menopause-resilience/biomarkers/${PROFILE_ID}`, data),
    onSuccess: () => { invalidate(); setShowLogBiomarker(false); toast({ title: "Biomarker saved" }); },
  });
  const updateProfile = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/menopause-resilience/profile/${PROFILE_ID}`, data),
    onSuccess: () => { invalidate(); setShowProfileSetup(false); toast({ title: "Profile updated" }); },
  });
  const addTherapy = useMutation({
    mutationFn: async (therapy: any) => {
      const profile = d?.profile;
      const therapies = [...(profile?.currentTherapies || []), therapy];
      return apiRequest("PUT", `/api/menopause-resilience/profile/${PROFILE_ID}`, { currentTherapies: therapies });
    },
    onSuccess: () => { invalidate(); setShowAddTherapy(false); toast({ title: "Therapy added" }); },
  });
  const createShare = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/menopause-resilience/share/${PROFILE_ID}`, data),
    onSuccess: () => { invalidate(); setShowShareDialog(false); toast({ title: "Share link created" }); },
  });
  const revokeShare = useMutation({
    mutationFn: (shareId: string) => apiRequest("DELETE", `/api/menopause-resilience/share/${PROFILE_ID}/${shareId}`),
    onSuccess: () => { invalidate(); toast({ title: "Share revoked" }); },
  });

  if (dashQ.isLoading) return <DashboardSkeleton />;

  const resilience = d?.resilienceScore;
  const hormones = d?.hormoneOverview || {};
  const insights = d?.insights || [];
  const shares = d?.providerShares || [];
  const profile = d?.profile;

  const hcClass = highContrast ? "contrast-more" : "";

  return (
    <div className={`p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 ${hcClass}`}
      style={highContrast ? { filter: "contrast(1.35)" } : undefined}
      data-testid="meno-resilience-dashboard">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Menopause Resilience Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {profile?.stage === "perimenopause" ? "Perimenopause" : profile?.stage === "menopause" ? "Menopause" : "Postmenopause"} care — hormones, biomarkers & resilience scoring
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HighContrastToggle enabled={highContrast} onToggle={() => setHighContrast(!highContrast)} />
          <Button variant="outline" size="sm" onClick={() => setShowProfileSetup(true)} data-testid="button-profile-setup"
            className="min-h-[44px] min-w-[44px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Activity className="h-4 w-4 mr-1.5" aria-hidden="true" /> Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddTherapy(true)} data-testid="button-add-therapy"
            className="min-h-[44px] min-w-[44px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" /> Therapy
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowLogBiomarker(true)} data-testid="button-log-biomarker"
            className="min-h-[44px] min-w-[44px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Target className="h-4 w-4 mr-1.5" aria-hidden="true" /> Biomarker
          </Button>
          <Button size="sm" onClick={() => setShowLogHormone(true)} data-testid="button-log-hormone"
            className="min-h-[44px] min-w-[44px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <FlaskConical className="h-4 w-4 mr-1.5" aria-hidden="true" /> Log Hormone
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-lg" role="tablist" aria-label="Dashboard sections">
          <TabsTrigger value="overview" data-testid="tab-overview" className="min-h-[44px] text-sm">Overview</TabsTrigger>
          <TabsTrigger value="hormones" data-testid="tab-hormones" className="min-h-[44px] text-sm">Hormones</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights" className="min-h-[44px] text-sm">Insights</TabsTrigger>
          <TabsTrigger value="provider" data-testid="tab-provider" className="min-h-[44px] text-sm">Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:row-span-2 border-border dark:border-border" data-testid="card-resilience-score">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" aria-hidden="true" /> Resilience Score
                </CardTitle>
                <CardDescription>Composite wellness across bone, muscle, heart & sleep</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <ResilienceGauge score={resilience?.overall || 0} />
                <div className="flex items-center gap-2">
                  {resilience?.trend && resilience.trend !== "insufficient_data" && (
                    <Badge variant="outline" className="capitalize">
                      {(() => { const Icon = TREND_ICONS[resilience.trend] || Minus; return <Icon className="h-3 w-3 mr-1" aria-hidden="true" />; })()}
                      {resilience.trend}
                    </Badge>
                  )}
                  {resilience?.trend === "insufficient_data" && (
                    <Badge variant="secondary" className="text-xs">More data needed for trend</Badge>
                  )}
                </div>
                <div className="w-full space-y-3 pt-2" role="list" aria-label="Resilience components">
                  {(["boneDensity", "muscleMass", "apoB", "sleepEfficiency"] as BiomarkerType[]).map((key) => {
                    const comp = resilience?.components?.[key];
                    const config = BIOMARKER_CONFIG[key];
                    const Icon = config.icon;
                    return (
                      <div key={key} className="space-y-1" role="listitem" data-testid={`resilience-component-${key}`}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${config.color}`} aria-hidden="true" />
                            <span className="font-medium">{config.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {comp?.value != null && <span className="text-xs text-muted-foreground">{comp.value} {comp.unit}</span>}
                            <Badge className={`text-xs ${STATUS_COLORS[comp?.status || "no_data"]}`}>{comp?.status?.replace("_", " ") || "no data"}</Badge>
                          </div>
                        </div>
                        <Progress value={comp?.score || 0} className="h-1.5" aria-label={`${config.label}: ${comp?.score || 0} out of 100`} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border dark:border-border" data-testid="card-hormone-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" /> Hormone Panel
                </CardTitle>
                <CardDescription>Estradiol, progesterone, testosterone & thyroid markers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(["estradiol", "progesterone", "testosterone", "TSH", "freeT3", "freeT4"] as MenoHormoneType[]).map((type) => {
                    const data = hormones[type];
                    const config = HORMONE_CONFIG[type];
                    return (
                      <div key={type} className="border border-border dark:border-border rounded-lg p-3 space-y-1.5 bg-card dark:bg-card hover:shadow-sm transition-shadow" data-testid={`card-hormone-${type}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${config.color}`}>{config.shortLabel}</span>
                          {data?.trend && data.trend !== "insufficient_data" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {data.trend === "rising" && <ArrowUp className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />}
                              {data.trend === "declining" && <ArrowDown className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />}
                              {data.trend === "stable" && <Minus className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />}
                              {data.trend}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xl font-bold text-foreground">
                          {data?.value != null ? data.value : "—"}
                          <span className="text-xs font-normal text-muted-foreground ml-1">{data?.unit || config.unit}</span>
                        </div>
                        {data?.range && <p className="text-[10px] text-muted-foreground leading-relaxed">Range: {data.range}</p>}
                        {data?.date && <p className="text-[10px] text-muted-foreground">Last: {data.date}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border dark:border-border" data-testid="card-therapies">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-pink-500 dark:text-pink-400" aria-hidden="true" /> Current Therapies
                    </CardTitle>
                    <CardDescription>HRT, supplements, and medications</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAddTherapy(true)} data-testid="button-add-therapy-card"
                    className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {profile?.currentTherapies?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {profile.currentTherapies.map((therapy: any, idx: number) => (
                      <div key={idx} className="border border-border dark:border-border rounded-lg p-3 flex items-start gap-3 bg-card dark:bg-card hover:shadow-sm transition-shadow" data-testid={`therapy-${idx}`}>
                        <Badge variant={therapy.type === "HRT" ? "default" : "secondary"} className="text-xs shrink-0 mt-0.5">
                          {therapy.type}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-foreground">{therapy.name}</p>
                          <p className="text-xs text-muted-foreground">{therapy.dosage} — {therapy.route}</p>
                          <p className="text-xs text-muted-foreground">Since {therapy.startDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No therapies logged yet — add HRT, supplements, or medications to track</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hormones" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Accordion type="multiple" defaultValue={["sex-hormones", "thyroid-markers"]} className="space-y-4">
            <AccordionItem value="sex-hormones" className="border border-border dark:border-border rounded-lg bg-card dark:bg-card overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline" data-testid="accordion-sex-hormones">
                <div className="flex items-center gap-2 text-left">
                  <FlaskConical className="h-5 w-5 text-pink-600 dark:text-pink-400 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-semibold text-lg text-foreground">Sex Hormones</span>
                    <p className="text-sm text-muted-foreground font-normal">Estradiol, progesterone, and testosterone</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {(["estradiol", "progesterone", "testosterone"] as MenoHormoneType[]).map((type) => {
                    const data = hormones[type];
                    const config = HORMONE_CONFIG[type];
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-sm ${config.color}`}>{config.label}</h4>
                          {data && <span className="text-sm font-bold text-foreground">{data.value} {data.unit}</span>}
                        </div>
                        <div className="h-2.5 bg-muted dark:bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={data?.value || 0} aria-valuemin={0} aria-valuemax={type === "estradiol" ? 400 : type === "progesterone" ? 20 : 70} aria-label={`${config.label} level`}>
                          <div className={`h-full rounded-full transition-all duration-700 ease-out ${type === "estradiol" ? "bg-pink-500 dark:bg-pink-400" : type === "progesterone" ? "bg-purple-500 dark:bg-purple-400" : "bg-blue-500 dark:bg-blue-400"}`}
                            style={{ width: data?.value ? `${Math.min((data.value / (type === "estradiol" ? 400 : type === "progesterone" ? 20 : 70)) * 100, 100)}%` : "0%" }} />
                        </div>
                        {data?.range && <p className="text-xs text-muted-foreground">Reference: {data.range}</p>}
                        {!data && <p className="text-xs text-muted-foreground">No readings logged</p>}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="thyroid-markers" className="border border-border dark:border-border rounded-lg bg-card dark:bg-card overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline" data-testid="accordion-thyroid-markers">
                <div className="flex items-center gap-2 text-left">
                  <Thermometer className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="font-semibold text-lg text-foreground">Thyroid Markers</span>
                    <p className="text-sm text-muted-foreground font-normal">TSH, Free T3, and Free T4 — critical during menopause transition</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  {(["TSH", "freeT3", "freeT4"] as MenoHormoneType[]).map((type) => {
                    const data = hormones[type];
                    const config = HORMONE_CONFIG[type];
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-semibold text-sm ${config.color}`}>{config.label}</h4>
                          {data && <span className="text-sm font-bold text-foreground">{data.value} {data.unit}</span>}
                        </div>
                        <div className="h-2.5 bg-muted dark:bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={data?.value || 0} aria-label={`${config.label} level`}>
                          <div className={`h-full rounded-full transition-all duration-700 ease-out ${type === "TSH" ? "bg-teal-500 dark:bg-teal-400" : type === "freeT3" ? "bg-orange-500 dark:bg-orange-400" : "bg-amber-500 dark:bg-amber-400"}`}
                            style={{ width: data?.value ? `${Math.min((data.value / (type === "TSH" ? 6 : type === "freeT3" ? 5 : 2.5)) * 100, 100)}%` : "0%" }} />
                        </div>
                        {data?.range && <p className="text-xs text-muted-foreground">Reference: {data.range}</p>}
                        {!data && <p className="text-xs text-muted-foreground">No readings logged</p>}
                      </div>
                    );
                  })}
                  <Alert className="mt-2 bg-muted/50 dark:bg-muted/20 border-border dark:border-border">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription className="text-xs leading-relaxed">
                      Thyroid dysfunction is more common during menopause transition. Symptoms overlap significantly with menopause (fatigue, weight changes, mood shifts). Regular thyroid monitoring is important.
                    </AlertDescription>
                  </Alert>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="resilience-biomarkers" className="border border-border dark:border-border rounded-lg bg-card dark:bg-card overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline" data-testid="accordion-biomarkers">
                <div className="flex items-center gap-2 text-left">
                  <Target className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <span className="font-semibold text-lg text-foreground">Resilience Biomarkers</span>
                    <p className="text-sm text-muted-foreground font-normal">Bone density, muscle mass, ApoB, and sleep efficiency</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={() => setShowLogBiomarker(true)} data-testid="button-log-biomarker-tab"
                    className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Log Biomarker
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(["boneDensity", "muscleMass", "apoB", "sleepEfficiency"] as BiomarkerType[]).map((type) => {
                    const comp = resilience?.components?.[type];
                    const config = BIOMARKER_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <div key={type} className="border border-border dark:border-border rounded-lg p-4 space-y-3 bg-background dark:bg-background hover:shadow-sm transition-shadow" data-testid={`biomarker-detail-${type}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${config.color}`} aria-hidden="true" />
                            <h4 className="font-semibold text-foreground">{config.label}</h4>
                          </div>
                          <Badge className={`${STATUS_COLORS[comp?.status || "no_data"]}`}>
                            {comp?.status?.replace("_", " ") || "no data"}
                          </Badge>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-foreground">{comp?.value != null ? comp.value : "—"}</span>
                          <span className="text-sm text-muted-foreground mb-1">{config.unit}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
                        {comp?.lastDate && <p className="text-xs text-muted-foreground">Last measured: {comp.lastDate}</p>}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Score:</span>
                          <Progress value={comp?.score || 0} className="h-1.5 flex-1" aria-label={`${config.label} score: ${comp?.score || 0} out of 100`} />
                          <span className="text-xs font-medium text-foreground">{comp?.score || 0}/100</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border dark:border-border" data-testid="card-insights">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500 dark:text-yellow-400" aria-hidden="true" /> Clinical Insights
              </CardTitle>
              <CardDescription>Personalized observations from your hormone and biomarker data</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length > 0 ? (
                <Accordion type="multiple" defaultValue={insights.filter((i: any) => i.severity === "action_needed").map((i: any) => i.id)} className="space-y-2">
                  {insights.map((insight: any) => (
                    <AccordionItem key={insight.id} value={insight.id} className={`border rounded-lg overflow-hidden ${
                      insight.severity === "action_needed" ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" :
                      insight.severity === "warning" ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20" :
                      "border-border dark:border-border"
                    }`} data-testid={`insight-${insight.type}`}>
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2 text-left flex-1">
                          {insight.severity === "action_needed" && <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" aria-hidden="true" />}
                          {insight.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400 shrink-0" aria-hidden="true" />}
                          {insight.severity === "info" && <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" aria-hidden="true" />}
                          <span className="font-medium text-foreground">{insight.title}</span>
                          <Badge variant={insight.severity === "action_needed" ? "destructive" : insight.severity === "warning" ? "outline" : "secondary"} className="text-xs ml-auto mr-2">
                            {insight.severity.replace("_", " ")}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{insight.description}</p>
                        {insight.actionable && insight.action && (
                          <Button variant="outline" size="sm" data-testid={`button-insight-${insight.type}`}
                            className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            {insight.action}
                          </Button>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
                  <p className="text-muted-foreground">Log hormone levels and biomarkers to receive personalized insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="provider" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border dark:border-border" data-testid="card-provider-sharing">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Share with Provider
                  </CardTitle>
                  <CardDescription>Send your resilience score, hormones, and biomarkers to your provider for counseling</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowShareDialog(true)} data-testid="button-create-share"
                  className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Link2 className="h-4 w-4 mr-1" aria-hidden="true" /> Create Share Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {shares.length > 0 ? (
                <div className="space-y-3" role="list" aria-label="Active provider shares">
                  {shares.map((share: any) => (
                    <div key={share.id} className="border border-border dark:border-border rounded-lg p-4 bg-card dark:bg-card hover:shadow-sm transition-shadow" role="listitem" data-testid={`share-${share.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                            <span className="font-medium text-foreground">{share.providerName}</span>
                            {share.providerSpecialty && <Badge variant="outline" className="text-xs">{share.providerSpecialty}</Badge>}
                          </div>
                          {share.providerEmail && <p className="text-sm text-muted-foreground">{share.providerEmail}</p>}
                          <div className="flex gap-1 flex-wrap mt-1">
                            {share.permissions.map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">{p.replace("_", " ")}</Badge>
                            ))}
                          </div>
                          {share.expiresAt && <p className="text-xs text-muted-foreground">Expires: {new Date(share.expiresAt).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" aria-label={`Copy share link for ${share.providerName}`}
                            className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/meno-shared/${share.shareToken}`); toast({ title: "Link copied" }); }} data-testid={`button-copy-${share.id}`}>
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="outline" size="sm" aria-label={`Revoke share for ${share.providerName}`}
                            className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => revokeShare.mutate(share.id)} data-testid={`button-revoke-${share.id}`}>
                            <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <Share2 className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
                  <p className="text-muted-foreground">No active provider shares</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Share your resilience score, hormone levels, and biomarkers with your endocrinologist, gynecologist, or primary care provider for personalized menopause counseling and remediation planning.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Accordion type="single" collapsible defaultValue="counseling-benefits">
            <AccordionItem value="counseling-benefits" className="border border-border dark:border-border rounded-lg bg-card dark:bg-card overflow-hidden" data-testid="card-counseling-benefits">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <Heart className="h-5 w-5 text-pink-500 dark:text-pink-400 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-lg text-foreground">Why Share with Your Provider?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-border dark:border-border rounded-lg p-4 space-y-2 text-center bg-background dark:bg-background">
                    <Brain className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    <h4 className="font-medium text-foreground">Informed Counseling</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">Your provider sees your actual estradiol, progesterone, and thyroid levels alongside your resilience score — enabling precise HRT dosing and supplement guidance</p>
                  </div>
                  <div className="border border-border dark:border-border rounded-lg p-4 space-y-2 text-center bg-background dark:bg-background">
                    <Target className="h-8 w-8 mx-auto text-green-600 dark:text-green-400" aria-hidden="true" />
                    <h4 className="font-medium text-foreground">Targeted Remediation</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">Low bone density? Elevated ApoB? Poor sleep? Your provider can create an evidence-based intervention plan addressing your specific weak points</p>
                  </div>
                  <div className="border border-border dark:border-border rounded-lg p-4 space-y-2 text-center bg-background dark:bg-background">
                    <TrendingUp className="h-8 w-8 mx-auto text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <h4 className="font-medium text-foreground">Track Progress</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">Monitor how your resilience score changes over time with therapy adjustments — objective feedback on what's working</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      <Alert className="bg-muted/50 dark:bg-muted/20 border-border dark:border-border">
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          {d?.disclaimer || "This menopause tracking dashboard is for personal health awareness only. Resilience scores are composite wellness indicators and do not constitute medical advice. Always consult your healthcare provider for clinical decisions."}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground py-2" aria-label="Accessibility features">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>WCAG 2.2 AA</span>
        </div>
        <span aria-hidden="true">|</span>
        <div className="flex items-center gap-1.5">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          <span>200% zoom supported</span>
        </div>
        <span aria-hidden="true">|</span>
        <div className="flex items-center gap-1.5">
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Dark mode ready</span>
        </div>
      </div>

      <Dialog open={showLogHormone} onOpenChange={setShowLogHormone}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Log Hormone Reading</DialogTitle>
            <DialogDescription>Record lab results or at-home test values</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-hormone" className="text-foreground">Hormone</Label>
              <Select value={hormoneForm.hormoneType} onValueChange={(v) => setHormoneForm({ ...hormoneForm, hormoneType: v as MenoHormoneType })}>
                <SelectTrigger id="menopause-resilience-hormone" data-testid="select-meno-hormone-type" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estradiol">Estradiol (E2)</SelectItem>
                  <SelectItem value="progesterone">Progesterone (P4)</SelectItem>
                  <SelectItem value="testosterone">Testosterone (T)</SelectItem>
                  <SelectItem value="TSH">TSH</SelectItem>
                  <SelectItem value="freeT3">Free T3</SelectItem>
                  <SelectItem value="freeT4">Free T4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-value" className="text-foreground">Value ({HORMONE_CONFIG[hormoneForm.hormoneType].unit})</Label>
                <Input id="menopause-resilience-value" type="number" step="0.01" value={hormoneForm.value} onChange={(e) => setHormoneForm({ ...hormoneForm, value: e.target.value })} placeholder="e.g. 45.2" data-testid="input-meno-hormone-value" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-date" className="text-foreground">Date</Label>
                <Input id="menopause-resilience-date" type="date" value={hormoneForm.date} onChange={(e) => setHormoneForm({ ...hormoneForm, date: e.target.value })} data-testid="input-meno-hormone-date" className="min-h-[44px]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-source" className="text-foreground">Source</Label>
              <Select value={hormoneForm.source} onValueChange={(v) => setHormoneForm({ ...hormoneForm, source: v as any })}>
                <SelectTrigger id="menopause-resilience-source" data-testid="select-meno-hormone-source" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lab">Lab Result</SelectItem>
                  <SelectItem value="at_home_kit">At-Home Test Kit</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-lab-name-optional" className="text-foreground">Lab Name (optional)</Label>
              <Input id="menopause-resilience-lab-name-optional" value={hormoneForm.labName} onChange={(e) => setHormoneForm({ ...hormoneForm, labName: e.target.value })} placeholder="e.g. Quest Diagnostics" data-testid="input-meno-lab-name" className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-notes-optional" className="text-foreground">Notes (optional)</Label>
              <Textarea id="menopause-resilience-notes-optional" value={hormoneForm.notes} onChange={(e) => setHormoneForm({ ...hormoneForm, notes: e.target.value })} placeholder="Any observations..." data-testid="input-meno-hormone-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogHormone(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={() => logHormone.mutate({ hormoneType: hormoneForm.hormoneType, value: parseFloat(hormoneForm.value), date: hormoneForm.date, unit: HORMONE_CONFIG[hormoneForm.hormoneType].unit, source: hormoneForm.source, labName: hormoneForm.labName || undefined, notes: hormoneForm.notes || undefined })}
              disabled={!hormoneForm.value || logHormone.isPending} data-testid="button-submit-meno-hormone" className="min-h-[44px]">
              {logHormone.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Saving...</> : "Save Reading"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogBiomarker} onOpenChange={setShowLogBiomarker}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Log Biomarker</DialogTitle>
            <DialogDescription>Record bone density, muscle mass, ApoB, or sleep efficiency</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-biomarker" className="text-foreground">Biomarker</Label>
              <Select value={biomarkerForm.type} onValueChange={(v) => setBiomarkerForm({ ...biomarkerForm, type: v as BiomarkerType })}>
                <SelectTrigger id="menopause-resilience-biomarker" data-testid="select-biomarker-type" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boneDensity">Bone Density (T-score)</SelectItem>
                  <SelectItem value="muscleMass">Muscle Mass (kg)</SelectItem>
                  <SelectItem value="apoB">ApoB (mg/dL)</SelectItem>
                  <SelectItem value="sleepEfficiency">Sleep Efficiency (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-value-2" className="text-foreground">Value ({BIOMARKER_CONFIG[biomarkerForm.type].unit})</Label>
                <Input id="menopause-resilience-value-2" type="number" step="0.1" value={biomarkerForm.value} onChange={(e) => setBiomarkerForm({ ...biomarkerForm, value: e.target.value })} placeholder={biomarkerForm.type === "boneDensity" ? "e.g. -1.2" : biomarkerForm.type === "sleepEfficiency" ? "e.g. 85" : "e.g. 92"} data-testid="input-biomarker-value" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-date-2" className="text-foreground">Date</Label>
                <Input id="menopause-resilience-date-2" type="date" value={biomarkerForm.date} onChange={(e) => setBiomarkerForm({ ...biomarkerForm, date: e.target.value })} data-testid="input-biomarker-date" className="min-h-[44px]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-source-2" className="text-foreground">Source</Label>
              <Select value={biomarkerForm.source} onValueChange={(v) => setBiomarkerForm({ ...biomarkerForm, source: v as any })}>
                <SelectTrigger id="menopause-resilience-source-2" data-testid="select-biomarker-source" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dexa_scan">DEXA Scan</SelectItem>
                  <SelectItem value="lab">Lab Result</SelectItem>
                  <SelectItem value="wearable">Wearable Device</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-notes-optional-2" className="text-foreground">Notes (optional)</Label>
              <Textarea id="menopause-resilience-notes-optional-2" value={biomarkerForm.notes} onChange={(e) => setBiomarkerForm({ ...biomarkerForm, notes: e.target.value })} data-testid="input-biomarker-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogBiomarker(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={() => logBiomarker.mutate({ type: biomarkerForm.type, value: parseFloat(biomarkerForm.value), date: biomarkerForm.date, unit: BIOMARKER_CONFIG[biomarkerForm.type].unit, source: biomarkerForm.source, notes: biomarkerForm.notes || undefined })}
              disabled={!biomarkerForm.value || logBiomarker.isPending} data-testid="button-submit-biomarker" className="min-h-[44px]">
              {logBiomarker.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Saving...</> : "Save Biomarker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Share with Provider</DialogTitle>
            <DialogDescription>Create a secure link for your provider to review your menopause data and resilience score</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-provider-name" className="text-foreground">Provider Name</Label>
              <Input id="menopause-resilience-provider-name" value={shareForm.providerName} onChange={(e) => setShareForm({ ...shareForm, providerName: e.target.value })} placeholder="Dr. Johnson" data-testid="input-meno-provider-name" className="min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-email-optional" className="text-foreground">Email (optional)</Label>
                <Input id="menopause-resilience-email-optional" type="email" value={shareForm.providerEmail} onChange={(e) => setShareForm({ ...shareForm, providerEmail: e.target.value })} placeholder="doctor@clinic.com" data-testid="input-meno-provider-email" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-specialty-optional" className="text-foreground">Specialty (optional)</Label>
                <Input id="menopause-resilience-specialty-optional" value={shareForm.providerSpecialty} onChange={(e) => setShareForm({ ...shareForm, providerSpecialty: e.target.value })} placeholder="e.g. Endocrinology" data-testid="input-meno-provider-specialty" className="min-h-[44px]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-expires-in" className="text-foreground">Expires In</Label>
              <Select value={String(shareForm.expiresInDays)} onValueChange={(v) => setShareForm({ ...shareForm, expiresInDays: parseInt(v) })}>
                <SelectTrigger id="menopause-resilience-expires-in" data-testid="select-meno-share-expiry" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FieldCaption className="text-foreground">Data to Share</FieldCaption>
              <div className="space-y-2">
                {[
                  { key: "hormones", label: "Hormone levels (E2, P4, T, thyroid)" },
                  { key: "biomarkers", label: "Biomarkers (bone, muscle, ApoB, sleep)" },
                  { key: "resilience_score", label: "Resilience score & trend" },
                  { key: "symptoms", label: "Symptoms" },
                  { key: "therapies", label: "Current therapies (HRT, supplements)" },
                  { key: "notes", label: "Personal notes" },
                ].map((perm) => (
                  <div key={perm.key} className="flex items-center gap-2 min-h-[36px]">
                    <Checkbox aria-label="Data to Share" id={`meno-perm-${perm.key}`} checked={shareForm.permissions.includes(perm.key)}
                      onCheckedChange={(checked) => setShareForm({ ...shareForm, permissions: checked ? [...shareForm.permissions, perm.key] : shareForm.permissions.filter(p => p !== perm.key) })}
                      data-testid={`checkbox-meno-perm-${perm.key}`} className="h-5 w-5" />
                    <Label htmlFor={`meno-perm-${perm.key}`} className="text-sm text-foreground cursor-pointer">{perm.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={() => createShare.mutate({ providerName: shareForm.providerName, providerEmail: shareForm.providerEmail || undefined, providerSpecialty: shareForm.providerSpecialty || undefined, permissions: shareForm.permissions, expiresInDays: shareForm.expiresInDays })}
              disabled={!shareForm.providerName || shareForm.permissions.length === 0 || createShare.isPending} data-testid="button-submit-meno-share" className="min-h-[44px]">
              {createShare.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Creating...</> : "Create Share Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileSetup} onOpenChange={setShowProfileSetup}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Menopause Profile</DialogTitle>
            <DialogDescription>Set your stage and basic details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-stage" className="text-foreground">Stage</Label>
              <Select value={profileForm.stage} onValueChange={(v) => setProfileForm({ ...profileForm, stage: v as MenoStage })}>
                <SelectTrigger id="menopause-resilience-stage" data-testid="select-meno-stage" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perimenopause">Perimenopause</SelectItem>
                  <SelectItem value="menopause">Menopause</SelectItem>
                  <SelectItem value="postmenopause">Postmenopause</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-age" className="text-foreground">Age</Label>
                <Input id="menopause-resilience-age" type="number" value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} placeholder="e.g. 48" data-testid="input-meno-age" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-last-period-date" className="text-foreground">Last Period Date</Label>
                <Input id="menopause-resilience-last-period-date" type="date" value={profileForm.lastPeriodDate} onChange={(e) => setProfileForm({ ...profileForm, lastPeriodDate: e.target.value })} data-testid="input-meno-last-period" className="min-h-[44px]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileSetup(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={() => updateProfile.mutate({ stage: profileForm.stage, age: profileForm.age ? parseInt(profileForm.age) : undefined, lastPeriodDate: profileForm.lastPeriodDate || undefined })}
              disabled={updateProfile.isPending} data-testid="button-submit-meno-profile" className="min-h-[44px]">
              {updateProfile.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Saving...</> : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTherapy} onOpenChange={setShowAddTherapy}>
        <DialogContent className="bg-background dark:bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Therapy</DialogTitle>
            <DialogDescription>Log HRT, supplements, or medications</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menopause-resilience-name" className="text-foreground">Name</Label>
              <Input id="menopause-resilience-name" value={therapyForm.name} onChange={(e) => setTherapyForm({ ...therapyForm, name: e.target.value })} placeholder="e.g. Estradiol patch, Vitamin D3, Magnesium" data-testid="input-therapy-name" className="min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-type" className="text-foreground">Type</Label>
                <Select value={therapyForm.type} onValueChange={(v) => setTherapyForm({ ...therapyForm, type: v as any })}>
                  <SelectTrigger id="menopause-resilience-type" data-testid="select-therapy-type" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HRT">Hormone Replacement Therapy</SelectItem>
                    <SelectItem value="supplement">Supplement</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-route" className="text-foreground">Route</Label>
                <Input id="menopause-resilience-route" value={therapyForm.route} onChange={(e) => setTherapyForm({ ...therapyForm, route: e.target.value })} placeholder="e.g. transdermal, oral, vaginal" data-testid="input-therapy-route" className="min-h-[44px]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-dosage" className="text-foreground">Dosage</Label>
                <Input id="menopause-resilience-dosage" value={therapyForm.dosage} onChange={(e) => setTherapyForm({ ...therapyForm, dosage: e.target.value })} placeholder="e.g. 0.1 mg/day" data-testid="input-therapy-dosage" className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menopause-resilience-start-date" className="text-foreground">Start Date</Label>
                <Input id="menopause-resilience-start-date" type="date" value={therapyForm.startDate} onChange={(e) => setTherapyForm({ ...therapyForm, startDate: e.target.value })} data-testid="input-therapy-start" className="min-h-[44px]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTherapy(false)} className="min-h-[44px]">Cancel</Button>
            <Button onClick={() => addTherapy.mutate({ name: therapyForm.name, type: therapyForm.type, dosage: therapyForm.dosage, route: therapyForm.route, startDate: therapyForm.startDate })}
              disabled={!therapyForm.name || !therapyForm.dosage || addTherapy.isPending} data-testid="button-submit-therapy" className="min-h-[44px]">
              {addTherapy.isPending ? <><Skeleton className="h-4 w-4 rounded-full mr-2 animate-spin" /> Adding...</> : "Add Therapy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
