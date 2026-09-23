import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  Baby,
  Bone,
  BookOpen,
  Calendar,
  CheckCircle2,
  Droplets,
  Flame,
  Heart,
  HeartPulse,
  Info,
  Pill,
  Plus,
  Scale,
  Stethoscope,
  Sun,
  Thermometer,
  TrendingUp,
  X,
} from "lucide-react";

const NO_ADVICE_DISCLAIMER = "This information is for personal health tracking and educational purposes only. It does not constitute medical advice. Always consult your healthcare provider for clinical decisions.";
const PROFILE_ID = "profile-default";

type LifeStage = "menstruation" | "pregnancy" | "menopause" | "postmenopause";
type FlowIntensity = "spotting" | "light" | "medium" | "heavy" | "very_heavy";
type MenstrualSymptom = "cramps" | "bloating" | "headache" | "fatigue" | "mood_changes" | "breast_tenderness" | "acne" | "back_pain" | "nausea" | "insomnia";
type MenopauseSymptom = "hot_flashes" | "night_sweats" | "mood_changes" | "sleep_disturbance" | "vaginal_dryness" | "weight_gain" | "joint_pain" | "brain_fog" | "low_libido" | "hair_thinning" | "heart_palpitations" | "urinary_changes";

interface DashboardData {
  lifeStage: LifeStage;
  menstruation?: {
    currentCycleDay?: number;
    averageCycleLength: number;
    lastPeriodStart?: string;
    nextPeriodEstimate?: string;
    recentSymptoms: MenstrualSymptom[];
    cycleRegularity: "regular" | "irregular" | "unknown";
    totalCyclesTracked: number;
  };
  pregnancy?: {
    currentWeek: number;
    trimester: 1 | 2 | 3;
    dueDate: string;
    daysUntilDue: number;
    upcomingAppointments: { id: string; date: string; type: string; provider?: string; notes?: string; completed: boolean }[];
    pendingMilestones: { milestone: string; completed: boolean; date?: string; notes?: string }[];
    latestWeight?: { date: string; weight: number; unit: string };
  };
  menopause?: {
    stage: string;
    daysSinceLastPeriod?: number;
    topSymptoms: { symptom: MenopauseSymptom; avgSeverity: number }[];
    activeHrt: { id: string; name: string; dosage: string; startDate: string }[];
    nextScreeningDue?: { type: string; dueDate: string };
  };
  screenings: { name: string; lastDate?: string; nextDue?: string; status: string }[];
  disclaimer: string;
}

interface CycleEntry {
  id: string;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
  periodLength?: number;
  flowIntensity: FlowIntensity;
  symptoms: MenstrualSymptom[];
  notes?: string;
  createdAt: string;
}

interface EducationalContent {
  title: string;
  summary: string;
  category: string;
}

const MENSTRUAL_SYMPTOMS: { value: MenstrualSymptom; label: string }[] = [
  { value: "cramps", label: "Cramps" },
  { value: "bloating", label: "Bloating" },
  { value: "headache", label: "Headache" },
  { value: "fatigue", label: "Fatigue" },
  { value: "mood_changes", label: "Mood Changes" },
  { value: "breast_tenderness", label: "Breast Tenderness" },
  { value: "acne", label: "Acne" },
  { value: "back_pain", label: "Back Pain" },
  { value: "nausea", label: "Nausea" },
  { value: "insomnia", label: "Insomnia" },
];

const MENOPAUSE_SYMPTOMS: { value: MenopauseSymptom; label: string }[] = [
  { value: "hot_flashes", label: "Hot Flashes" },
  { value: "night_sweats", label: "Night Sweats" },
  { value: "mood_changes", label: "Mood Changes" },
  { value: "sleep_disturbance", label: "Sleep Disturbance" },
  { value: "vaginal_dryness", label: "Vaginal Dryness" },
  { value: "weight_gain", label: "Weight Gain" },
  { value: "joint_pain", label: "Joint Pain" },
  { value: "brain_fog", label: "Brain Fog" },
  { value: "low_libido", label: "Low Libido" },
  { value: "hair_thinning", label: "Hair Thinning" },
  { value: "heart_palpitations", label: "Heart Palpitations" },
  { value: "urinary_changes", label: "Urinary Changes" },
];

const FLOW_OPTIONS: { value: FlowIntensity; label: string; color: string }[] = [
  { value: "spotting", label: "Spotting", color: "bg-pink-200" },
  { value: "light", label: "Light", color: "bg-pink-300" },
  { value: "medium", label: "Medium", color: "bg-pink-400" },
  { value: "heavy", label: "Heavy", color: "bg-pink-500" },
  { value: "very_heavy", label: "Very Heavy", color: "bg-pink-600" },
];

const MILESTONE_LABELS: Record<string, string> = {
  first_ultrasound: "First Ultrasound",
  anatomy_scan: "Anatomy Scan",
  glucose_test: "Glucose Test",
  group_b_strep: "Group B Strep Test",
  tdap_vaccine: "Tdap Vaccine",
  rh_factor_test: "Rh Factor Test",
  genetic_screening: "Genetic Screening",
  fetal_movement: "First Fetal Movement",
  birth_plan: "Birth Plan Complete",
  hospital_tour: "Hospital Tour",
};

function formatSymptom(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function WomensHealth() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCycleDialog, setShowCycleDialog] = useState(false);
  const [showPregnancyDialog, setShowPregnancyDialog] = useState(false);
  const [showMenopauseDialog, setShowMenopauseDialog] = useState(false);
  const [showSymptomDialog, setShowSymptomDialog] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [showHrtDialog, setShowHrtDialog] = useState(false);
  const [showScreeningDialog, setShowScreeningDialog] = useState(false);

  const [cycleForm, setCycleForm] = useState({ startDate: "", endDate: "", flowIntensity: "medium" as FlowIntensity, symptoms: [] as MenstrualSymptom[], notes: "" });
  const [pregnancyForm, setPregnancyForm] = useState({ dueDate: "", lastMenstrualPeriod: "", provider: "" });
  const [menopauseForm, setMenopauseForm] = useState({ stage: "perimenopause" as string, lastPeriodDate: "" });
  const [symptomForm, setSymptomForm] = useState({ date: new Date().toISOString().split("T")[0], symptoms: [] as { symptom: MenopauseSymptom; severity: number }[], notes: "" });
  const [weightForm, setWeightForm] = useState({ date: new Date().toISOString().split("T")[0], weight: "", unit: "lbs" });
  const [appointmentForm, setAppointmentForm] = useState({ date: "", type: "", provider: "", notes: "" });
  const [hrtForm, setHrtForm] = useState({ name: "", dosage: "", startDate: "" });
  const [screeningForm, setScreeningForm] = useState({ date: "", type: "", result: "", tScore: "", notes: "", screeningCategory: "bone" as "bone" | "cardio" });

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["/api/womens-health/dashboard", PROFILE_ID],
    queryFn: () => fetch(`/api/womens-health/dashboard/${PROFILE_ID}`).then(r => r.json()),
  });

  const cyclesQuery = useQuery<CycleEntry[]>({
    queryKey: ["/api/womens-health/cycles", PROFILE_ID],
    queryFn: () => fetch(`/api/womens-health/cycles/${PROFILE_ID}`).then(r => r.json()),
  });

  const educationQuery = useQuery<EducationalContent[]>({
    queryKey: ["/api/womens-health/education", dashboardQuery.data?.lifeStage || "menstruation"],
    queryFn: () => fetch(`/api/womens-health/education/${dashboardQuery.data?.lifeStage || "menstruation"}`).then(r => r.json()),
  });

  const setLifeStageMutation = useMutation({
    mutationFn: (stage: LifeStage) => apiRequest("PUT", `/api/womens-health/life-stage/${PROFILE_ID}`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/education"] });
      toast({ title: "Life stage updated" });
    },
  });

  const addCycleMutation = useMutation({
    mutationFn: (data: typeof cycleForm) => apiRequest("POST", `/api/womens-health/cycles/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowCycleDialog(false);
      setCycleForm({ startDate: "", endDate: "", flowIntensity: "medium", symptoms: [], notes: "" });
      toast({ title: "Period logged successfully" });
    },
  });

  const createPregnancyMutation = useMutation({
    mutationFn: (data: typeof pregnancyForm) => apiRequest("POST", `/api/womens-health/pregnancy/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowPregnancyDialog(false);
      setPregnancyForm({ dueDate: "", lastMenstrualPeriod: "", provider: "" });
      toast({ title: "Pregnancy profile created" });
    },
  });

  const createMenopauseMutation = useMutation({
    mutationFn: (data: typeof menopauseForm) => apiRequest("POST", `/api/womens-health/menopause/${PROFILE_ID}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowMenopauseDialog(false);
      setMenopauseForm({ stage: "perimenopause", lastPeriodDate: "" });
      toast({ title: "Menopause profile created" });
    },
  });

  const addSymptomsMutation = useMutation({
    mutationFn: (data: typeof symptomForm) => apiRequest("POST", `/api/womens-health/menopause/${PROFILE_ID}/symptoms`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowSymptomDialog(false);
      setSymptomForm({ date: new Date().toISOString().split("T")[0], symptoms: [], notes: "" });
      toast({ title: "Symptoms logged" });
    },
  });

  const addWeightMutation = useMutation({
    mutationFn: (data: { date: string; weight: number; unit: string }) => apiRequest("POST", `/api/womens-health/pregnancy/${PROFILE_ID}/weight`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowWeightDialog(false);
      setWeightForm({ date: new Date().toISOString().split("T")[0], weight: "", unit: "lbs" });
      toast({ title: "Weight recorded" });
    },
  });

  const addAppointmentMutation = useMutation({
    mutationFn: (data: typeof appointmentForm) => apiRequest("POST", `/api/womens-health/pregnancy/${PROFILE_ID}/appointment`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowAppointmentDialog(false);
      setAppointmentForm({ date: "", type: "", provider: "", notes: "" });
      toast({ title: "Appointment added" });
    },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: (data: { milestone: string; completed: boolean }) => apiRequest("PATCH", `/api/womens-health/pregnancy/${PROFILE_ID}/milestone`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      toast({ title: "Milestone updated" });
    },
  });

  const addHrtMutation = useMutation({
    mutationFn: (data: typeof hrtForm) => apiRequest("POST", `/api/womens-health/menopause/${PROFILE_ID}/hrt`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowHrtDialog(false);
      setHrtForm({ name: "", dosage: "", startDate: "" });
      toast({ title: "HRT medication added" });
    },
  });

  const addScreeningMutation = useMutation({
    mutationFn: (data: { date: string; type: string; result?: string; tScore?: number; notes?: string; category: string }) => {
      const endpoint = data.category === "bone" ? "bone-screening" : "cardio-screening";
      const { category, ...payload } = data;
      return apiRequest("POST", `/api/womens-health/menopause/${PROFILE_ID}/${endpoint}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/womens-health/dashboard"] });
      setShowScreeningDialog(false);
      setScreeningForm({ date: "", type: "", result: "", tScore: "", notes: "", screeningCategory: "bone" });
      toast({ title: "Screening recorded" });
    },
  });

  const dashboard = dashboardQuery.data;

  if (dashboardQuery.isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl space-y-4" data-testid="womens-health-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const lifeStage = dashboard?.lifeStage || "menstruation";

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6" data-testid="womens-health-page">
      <Alert className="border-pink-200 bg-pink-50 dark:bg-pink-950/20 dark:border-pink-800" data-testid="disclaimer-alert">
        <Info className="h-4 w-4 text-pink-600" />
        <AlertTitle className="text-pink-800 dark:text-pink-300">Educational Information Only</AlertTitle>
        <AlertDescription className="text-pink-700 dark:text-pink-400 text-sm">{NO_ADVICE_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Women's Health</h1>
          <p className="text-muted-foreground text-sm">Track your cycle, pregnancy, menopause, and preventive care</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="womens-health-life-stage" className="text-sm font-medium whitespace-nowrap">Life Stage:</Label>
          <Select value={lifeStage} onValueChange={(v) => setLifeStageMutation.mutate(v as LifeStage)}>
            <SelectTrigger id="womens-health-life-stage" className="w-[180px]" data-testid="select-life-stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="menstruation">Menstruation</SelectItem>
              <SelectItem value="pregnancy">Pregnancy</SelectItem>
              <SelectItem value="menopause">Menopause</SelectItem>
              <SelectItem value="postmenopause">Post-Menopause</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-4" data-testid="tabs-list">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tracking" data-testid="tab-tracking">Tracking</TabsTrigger>
          <TabsTrigger value="screenings" data-testid="tab-screenings">Screenings</TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">Education</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4" data-testid="dashboard-tab-content">
          {lifeStage === "menstruation" && <MenstruationDashboard data={dashboard?.menstruation} onLogPeriod={() => setShowCycleDialog(true)} />}
          {lifeStage === "pregnancy" && (
            <PregnancyDashboard
              data={dashboard?.pregnancy}
              onSetup={() => setShowPregnancyDialog(true)}
              onAddWeight={() => setShowWeightDialog(true)}
              onAddAppointment={() => setShowAppointmentDialog(true)}
              onToggleMilestone={(m, c) => toggleMilestoneMutation.mutate({ milestone: m, completed: c })}
            />
          )}
          {(lifeStage === "menopause" || lifeStage === "postmenopause") && (
            <MenopauseDashboard
              data={dashboard?.menopause}
              stage={lifeStage}
              onSetup={() => setShowMenopauseDialog(true)}
              onLogSymptoms={() => setShowSymptomDialog(true)}
              onAddHrt={() => setShowHrtDialog(true)}
              onAddScreening={() => setShowScreeningDialog(true)}
            />
          )}
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4" data-testid="tracking-tab-content">
          {lifeStage === "menstruation" && (
            <CycleHistory cycles={cyclesQuery.data || []} onLogPeriod={() => setShowCycleDialog(true)} />
          )}
          {lifeStage === "pregnancy" && (
            <PregnancyTracking
              data={dashboard?.pregnancy}
              onAddWeight={() => setShowWeightDialog(true)}
              onAddAppointment={() => setShowAppointmentDialog(true)}
              onToggleMilestone={(m, c) => toggleMilestoneMutation.mutate({ milestone: m, completed: c })}
            />
          )}
          {(lifeStage === "menopause" || lifeStage === "postmenopause") && (
            <MenopauseTracking
              data={dashboard?.menopause}
              onLogSymptoms={() => setShowSymptomDialog(true)}
              onAddHrt={() => setShowHrtDialog(true)}
            />
          )}
        </TabsContent>

        <TabsContent value="screenings" className="space-y-4" data-testid="screenings-tab-content">
          <ScreeningsPanel screenings={dashboard?.screenings || []} lifeStage={lifeStage} onAddScreening={() => setShowScreeningDialog(true)} />
        </TabsContent>

        <TabsContent value="education" className="space-y-4" data-testid="education-tab-content">
          <EducationPanel content={educationQuery.data || []} lifeStage={lifeStage} />
        </TabsContent>
      </Tabs>

      <LogPeriodDialog
        open={showCycleDialog}
        onClose={() => setShowCycleDialog(false)}
        form={cycleForm}
        setForm={setCycleForm}
        onSubmit={() => addCycleMutation.mutate(cycleForm)}
        isPending={addCycleMutation.isPending}
      />

      <Dialog open={showPregnancyDialog} onOpenChange={setShowPregnancyDialog}>
        <DialogContent data-testid="pregnancy-dialog">
          <DialogHeader>
            <DialogTitle>Set Up Pregnancy Profile</DialogTitle>
            <DialogDescription>Enter your pregnancy details to start tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="womens-health-due-date">Due Date *</Label><Input id="womens-health-due-date" type="date" value={pregnancyForm.dueDate} onChange={e => setPregnancyForm(p => ({ ...p, dueDate: e.target.value }))} data-testid="input-due-date" /></div>
            <div><Label htmlFor="womens-health-last-menstrual-period">Last Menstrual Period</Label><Input id="womens-health-last-menstrual-period" type="date" value={pregnancyForm.lastMenstrualPeriod} onChange={e => setPregnancyForm(p => ({ ...p, lastMenstrualPeriod: e.target.value }))} data-testid="input-lmp" /></div>
            <div><Label htmlFor="womens-health-provider">Provider</Label><Input id="womens-health-provider" value={pregnancyForm.provider} onChange={e => setPregnancyForm(p => ({ ...p, provider: e.target.value }))} placeholder="OB/GYN name" data-testid="input-provider" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createPregnancyMutation.mutate(pregnancyForm)} disabled={!pregnancyForm.dueDate || createPregnancyMutation.isPending} data-testid="button-create-pregnancy">
              {createPregnancyMutation.isPending ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMenopauseDialog} onOpenChange={setShowMenopauseDialog}>
        <DialogContent data-testid="menopause-dialog">
          <DialogHeader>
            <DialogTitle>Set Up Menopause Profile</DialogTitle>
            <DialogDescription>Track your menopause journey and symptoms.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="womens-health-stage">Stage</Label>
              <Select value={menopauseForm.stage} onValueChange={v => setMenopauseForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger id="womens-health-stage" data-testid="select-menopause-stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perimenopause">Perimenopause</SelectItem>
                  <SelectItem value="menopause">Menopause</SelectItem>
                  <SelectItem value="postmenopause">Post-Menopause</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="womens-health-date-of-last-period-if-known">Date of Last Period (if known)</Label><Input id="womens-health-date-of-last-period-if-known" type="date" value={menopauseForm.lastPeriodDate} onChange={e => setMenopauseForm(p => ({ ...p, lastPeriodDate: e.target.value }))} data-testid="input-last-period" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMenopauseMutation.mutate(menopauseForm)} disabled={createMenopauseMutation.isPending} data-testid="button-create-menopause">
              {createMenopauseMutation.isPending ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSymptomDialog} onOpenChange={setShowSymptomDialog}>
        <DialogContent className="max-w-lg" data-testid="symptom-dialog">
          <DialogHeader>
            <DialogTitle>Log Symptoms</DialogTitle>
            <DialogDescription>Record your symptoms and their severity today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="womens-health-date">Date</Label><Input id="womens-health-date" type="date" value={symptomForm.date} onChange={e => setSymptomForm(p => ({ ...p, date: e.target.value }))} data-testid="input-symptom-date" /></div>
            <div className="space-y-2">
              <Label htmlFor="womens-health-symptoms-severity-1-5">Symptoms & Severity (1-5)</Label>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {MENOPAUSE_SYMPTOMS.map(s => {
                  const existing = symptomForm.symptoms.find(x => x.symptom === s.value);
                  return (
                    <div key={s.value} className="flex items-center justify-between gap-2 p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <Checkbox id="womens-health-symptoms-severity-1-5"
                          checked={!!existing}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSymptomForm(p => ({ ...p, symptoms: [...p.symptoms, { symptom: s.value, severity: 3 }] }));
                            } else {
                              setSymptomForm(p => ({ ...p, symptoms: p.symptoms.filter(x => x.symptom !== s.value) }));
                            }
                          }}
                          data-testid={`checkbox-symptom-${s.value}`}
                        />
                        <span className="text-sm">{s.label}</span>
                      </div>
                      {existing && (
                        <Select
                          value={String(existing.severity)}
                          onValueChange={v => setSymptomForm(p => ({
                            ...p,
                            symptoms: p.symptoms.map(x => x.symptom === s.value ? { ...x, severity: parseInt(v) } : x),
                          }))}
                        >
                          <SelectTrigger className="w-16" data-testid={`select-severity-${s.value}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div><Label htmlFor="womens-health-notes">Notes</Label><Textarea id="womens-health-notes" value={symptomForm.notes} onChange={e => setSymptomForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." data-testid="input-symptom-notes" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => addSymptomsMutation.mutate(symptomForm)} disabled={symptomForm.symptoms.length === 0 || addSymptomsMutation.isPending} data-testid="button-save-symptoms">
              {addSymptomsMutation.isPending ? "Saving..." : "Save Symptoms"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
        <DialogContent data-testid="weight-dialog">
          <DialogHeader>
            <DialogTitle>Log Weight</DialogTitle>
            <DialogDescription>Track your weight during pregnancy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="womens-health-date-2">Date</Label><Input id="womens-health-date-2" type="date" value={weightForm.date} onChange={e => setWeightForm(p => ({ ...p, date: e.target.value }))} data-testid="input-weight-date" /></div>
            <div><Label htmlFor="womens-health-weight">Weight</Label><Input id="womens-health-weight" type="number" value={weightForm.weight} onChange={e => setWeightForm(p => ({ ...p, weight: e.target.value }))} placeholder="Enter weight" data-testid="input-weight-value" /></div>
            <div>
              <Label htmlFor="womens-health-unit">Unit</Label>
              <Select value={weightForm.unit} onValueChange={v => setWeightForm(p => ({ ...p, unit: v }))}>
                <SelectTrigger id="womens-health-unit" data-testid="select-weight-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">lbs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addWeightMutation.mutate({ date: weightForm.date, weight: parseFloat(weightForm.weight), unit: weightForm.unit })} disabled={!weightForm.weight || addWeightMutation.isPending} data-testid="button-save-weight">
              {addWeightMutation.isPending ? "Saving..." : "Save Weight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAppointmentDialog} onOpenChange={setShowAppointmentDialog}>
        <DialogContent data-testid="appointment-dialog">
          <DialogHeader>
            <DialogTitle>Add Appointment</DialogTitle>
            <DialogDescription>Schedule a prenatal appointment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="womens-health-date-3">Date *</Label><Input id="womens-health-date-3" type="date" value={appointmentForm.date} onChange={e => setAppointmentForm(p => ({ ...p, date: e.target.value }))} data-testid="input-appt-date" /></div>
            <div>
              <Label htmlFor="womens-health-type">Type *</Label>
              <Select value={appointmentForm.type} onValueChange={v => setAppointmentForm(p => ({ ...p, type: v }))}>
                <SelectTrigger id="womens-health-type" data-testid="select-appt-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prenatal_checkup">Prenatal Checkup</SelectItem>
                  <SelectItem value="ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="lab_work">Lab Work</SelectItem>
                  <SelectItem value="specialist">Specialist Visit</SelectItem>
                  <SelectItem value="childbirth_class">Childbirth Class</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="womens-health-provider-2">Provider</Label><Input id="womens-health-provider-2" value={appointmentForm.provider} onChange={e => setAppointmentForm(p => ({ ...p, provider: e.target.value }))} placeholder="Provider name" data-testid="input-appt-provider" /></div>
            <div><Label htmlFor="womens-health-notes-2">Notes</Label><Textarea id="womens-health-notes-2" value={appointmentForm.notes} onChange={e => setAppointmentForm(p => ({ ...p, notes: e.target.value }))} placeholder="Appointment notes..." data-testid="input-appt-notes" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => addAppointmentMutation.mutate(appointmentForm)} disabled={!appointmentForm.date || !appointmentForm.type || addAppointmentMutation.isPending} data-testid="button-save-appointment">
              {addAppointmentMutation.isPending ? "Saving..." : "Save Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHrtDialog} onOpenChange={setShowHrtDialog}>
        <DialogContent data-testid="hrt-dialog">
          <DialogHeader>
            <DialogTitle>Add HRT Medication</DialogTitle>
            <DialogDescription>Record a hormone replacement therapy medication.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="womens-health-medication-name">Medication Name *</Label><Input id="womens-health-medication-name" value={hrtForm.name} onChange={e => setHrtForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Estradiol patch" data-testid="input-hrt-name" /></div>
            <div><Label htmlFor="womens-health-dosage">Dosage *</Label><Input id="womens-health-dosage" value={hrtForm.dosage} onChange={e => setHrtForm(p => ({ ...p, dosage: e.target.value }))} placeholder="e.g., 0.05 mg/day" data-testid="input-hrt-dosage" /></div>
            <div><Label htmlFor="womens-health-start-date">Start Date *</Label><Input id="womens-health-start-date" type="date" value={hrtForm.startDate} onChange={e => setHrtForm(p => ({ ...p, startDate: e.target.value }))} data-testid="input-hrt-start" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => addHrtMutation.mutate(hrtForm)} disabled={!hrtForm.name || !hrtForm.dosage || !hrtForm.startDate || addHrtMutation.isPending} data-testid="button-save-hrt">
              {addHrtMutation.isPending ? "Saving..." : "Save Medication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScreeningDialog} onOpenChange={setShowScreeningDialog}>
        <DialogContent data-testid="screening-dialog">
          <DialogHeader>
            <DialogTitle>Record Screening</DialogTitle>
            <DialogDescription>Log a bone density or cardiovascular screening result.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="womens-health-category">Category</Label>
              <Select value={screeningForm.screeningCategory} onValueChange={v => setScreeningForm(p => ({ ...p, screeningCategory: v as "bone" | "cardio" }))}>
                <SelectTrigger id="womens-health-category" data-testid="select-screening-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bone">Bone Health</SelectItem>
                  <SelectItem value="cardio">Cardiovascular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="womens-health-date-4">Date *</Label><Input id="womens-health-date-4" type="date" value={screeningForm.date} onChange={e => setScreeningForm(p => ({ ...p, date: e.target.value }))} data-testid="input-screening-date" /></div>
            <div><Label htmlFor="womens-health-type-2">Type *</Label><Input id="womens-health-type-2" value={screeningForm.type} onChange={e => setScreeningForm(p => ({ ...p, type: e.target.value }))} placeholder="e.g., DEXA Scan, Lipid Panel" data-testid="input-screening-type" /></div>
            <div><Label htmlFor="womens-health-result">Result</Label><Input id="womens-health-result" value={screeningForm.result} onChange={e => setScreeningForm(p => ({ ...p, result: e.target.value }))} placeholder="Test result" data-testid="input-screening-result" /></div>
            {screeningForm.screeningCategory === "bone" && (
              <div><Label htmlFor="womens-health-t-score">T-Score</Label><Input id="womens-health-t-score" type="number" step="0.1" value={screeningForm.tScore} onChange={e => setScreeningForm(p => ({ ...p, tScore: e.target.value }))} placeholder="-1.0" data-testid="input-screening-tscore" /></div>
            )}
            <div><Label htmlFor="womens-health-notes-3">Notes</Label><Textarea id="womens-health-notes-3" value={screeningForm.notes} onChange={e => setScreeningForm(p => ({ ...p, notes: e.target.value }))} data-testid="input-screening-notes" /></div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addScreeningMutation.mutate({
                date: screeningForm.date,
                type: screeningForm.type,
                result: screeningForm.result || undefined,
                tScore: screeningForm.tScore ? parseFloat(screeningForm.tScore) : undefined,
                notes: screeningForm.notes || undefined,
                category: screeningForm.screeningCategory,
              })}
              disabled={!screeningForm.date || !screeningForm.type || addScreeningMutation.isPending}
              data-testid="button-save-screening"
            >
              {addScreeningMutation.isPending ? "Saving..." : "Save Screening"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenstruationDashboard({ data, onLogPeriod }: { data?: DashboardData["menstruation"]; onLogPeriod: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-cycle-day">
          <CardHeader className="pb-2">
            <CardDescription>Current Cycle Day</CardDescription>
            <CardTitle className="text-3xl text-pink-600">{data?.currentCycleDay ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Avg cycle: {data?.averageCycleLength ?? 28} days</p>
          </CardContent>
        </Card>
        <Card data-testid="card-next-period">
          <CardHeader className="pb-2">
            <CardDescription>Next Period Estimate</CardDescription>
            <CardTitle className="text-lg">{data?.nextPeriodEstimate ? new Date(data.nextPeriodEstimate).toLocaleDateString() : "Not enough data"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={data?.cycleRegularity === "regular" ? "default" : data?.cycleRegularity === "irregular" ? "destructive" : "secondary"} data-testid="badge-regularity">
              {data?.cycleRegularity === "regular" ? "Regular" : data?.cycleRegularity === "irregular" ? "Irregular" : "Unknown"}
            </Badge>
          </CardContent>
        </Card>
        <Card data-testid="card-cycles-tracked">
          <CardHeader className="pb-2">
            <CardDescription>Cycles Tracked</CardDescription>
            <CardTitle className="text-3xl">{data?.totalCyclesTracked ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={onLogPeriod} className="w-full" data-testid="button-log-period">
              <Plus className="h-4 w-4 mr-1" /> Log Period
            </Button>
          </CardContent>
        </Card>
      </div>

      {data?.recentSymptoms && data.recentSymptoms.length > 0 && (
        <Card data-testid="card-recent-symptoms">
          <CardHeader>
            <CardTitle className="text-base">Recent Symptoms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.recentSymptoms.map(s => (
                <Badge key={s} variant="outline" className="bg-pink-50 dark:bg-pink-950/30" data-testid={`badge-symptom-${s}`}>{formatSymptom(s)}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PregnancyDashboard({ data, onSetup, onAddWeight, onAddAppointment, onToggleMilestone }: {
  data?: DashboardData["pregnancy"];
  onSetup: () => void;
  onAddWeight: () => void;
  onAddAppointment: () => void;
  onToggleMilestone: (m: string, c: boolean) => void;
}) {
  if (!data) {
    return (
      <Card className="text-center py-12" data-testid="pregnancy-setup-card">
        <CardContent className="space-y-4">
          <Baby className="h-16 w-16 mx-auto text-pink-400" />
          <h3 className="text-xl font-semibold">Set Up Pregnancy Tracking</h3>
          <p className="text-muted-foreground">Start tracking your pregnancy journey by entering your due date.</p>
          <Button onClick={onSetup} size="lg" data-testid="button-setup-pregnancy">
            <Plus className="h-4 w-4 mr-2" /> Set Up Pregnancy Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = Math.min(100, Math.round((data.currentWeek / 40) * 100));
  const trimesterLabel = data.trimester === 1 ? "First Trimester" : data.trimester === 2 ? "Second Trimester" : "Third Trimester";

  return (
    <div className="space-y-4">
      <Card data-testid="card-pregnancy-overview">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Week {data.currentWeek}</CardTitle>
              <CardDescription>{trimesterLabel} • Due {new Date(data.dueDate).toLocaleDateString()}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-1" data-testid="badge-days-until-due">
              {data.daysUntilDue} days to go
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Pregnancy Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" data-testid="progress-pregnancy" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Week 1</span>
              <span>Week 13</span>
              <span>Week 27</span>
              <span>Week 40</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-upcoming-appointments">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Appointments</CardTitle>
              <Button size="sm" variant="outline" onClick={onAddAppointment} data-testid="button-add-appointment">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingAppointments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded border text-sm" data-testid={`appointment-${a.id}`}>
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>
                      <p className="text-muted-foreground text-xs">{new Date(a.date).toLocaleDateString()}{a.provider ? ` • ${a.provider}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-weight-tracking">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Weight Tracking</CardTitle>
              <Button size="sm" variant="outline" onClick={onAddWeight} data-testid="button-add-weight">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.latestWeight ? (
              <div className="flex items-center gap-3">
                <Scale className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{data.latestWeight.weight} {data.latestWeight.unit}</p>
                  <p className="text-xs text-muted-foreground">Last recorded: {new Date(data.latestWeight.date).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weight entries yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.pendingMilestones.length > 0 && (
        <Card data-testid="card-milestones">
          <CardHeader>
            <CardTitle className="text-base">Pregnancy Milestones</CardTitle>
            <CardDescription>Track important milestones during your pregnancy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.pendingMilestones.map((m) => (
                <div key={m.milestone} className="flex items-center gap-2 p-2 rounded border" data-testid={`milestone-${m.milestone}`}>
                  <Checkbox
                    checked={m.completed}
                    onCheckedChange={(checked) => onToggleMilestone(m.milestone, !!checked)}
                    data-testid={`checkbox-milestone-${m.milestone}`}
                  />
                  <span className="text-sm">{MILESTONE_LABELS[m.milestone] || m.milestone}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MenopauseDashboard({ data, stage, onSetup, onLogSymptoms, onAddHrt, onAddScreening }: {
  data?: DashboardData["menopause"];
  stage: LifeStage;
  onSetup: () => void;
  onLogSymptoms: () => void;
  onAddHrt: () => void;
  onAddScreening: () => void;
}) {
  if (!data || (data.topSymptoms.length === 0 && data.activeHrt.length === 0 && !data.daysSinceLastPeriod)) {
    return (
      <Card className="text-center py-12" data-testid="menopause-setup-card">
        <CardContent className="space-y-4">
          <Sun className="h-16 w-16 mx-auto text-amber-400" />
          <h3 className="text-xl font-semibold">Set Up {stage === "postmenopause" ? "Post-Menopause" : "Menopause"} Profile</h3>
          <p className="text-muted-foreground">Start tracking your symptoms, medications, and screenings.</p>
          <Button onClick={onSetup} size="lg" data-testid="button-setup-menopause">
            <Plus className="h-4 w-4 mr-2" /> Set Up Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-menopause-stage">
          <CardHeader className="pb-2">
            <CardDescription>Current Stage</CardDescription>
            <CardTitle className="text-lg capitalize">{data.stage.replace("post", "Post-")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.daysSinceLastPeriod !== undefined && (
              <p className="text-sm text-muted-foreground">{data.daysSinceLastPeriod} days since last period</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-top-symptoms">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Top Symptoms</CardDescription>
              <Button size="sm" variant="ghost" onClick={onLogSymptoms} data-testid="button-log-symptoms-quick">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.topSymptoms.length > 0 ? (
              <div className="space-y-1">
                {data.topSymptoms.slice(0, 3).map(s => (
                  <div key={s.symptom} className="flex items-center justify-between text-sm">
                    <span>{formatSymptom(s.symptom)}</span>
                    <Badge variant="outline" className="text-xs">{s.avgSeverity}/5</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No symptoms logged yet</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-active-hrt">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Active HRT</CardDescription>
              <Button size="sm" variant="ghost" onClick={onAddHrt} data-testid="button-add-hrt-quick">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.activeHrt.length > 0 ? (
              <div className="space-y-1">
                {data.activeHrt.map(m => (
                  <div key={m.id} className="text-sm">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-muted-foreground text-xs">{m.dosage}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No HRT medications</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onLogSymptoms} data-testid="button-log-symptoms">
          <Thermometer className="h-4 w-4 mr-2" /> Log Symptoms
        </Button>
        <Button variant="outline" onClick={onAddHrt} data-testid="button-add-hrt">
          <Pill className="h-4 w-4 mr-2" /> Add HRT Medication
        </Button>
        <Button variant="outline" onClick={onAddScreening} data-testid="button-add-screening">
          <Stethoscope className="h-4 w-4 mr-2" /> Record Screening
        </Button>
      </div>
    </div>
  );
}

function CycleHistory({ cycles, onLogPeriod }: { cycles: CycleEntry[]; onLogPeriod: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cycle History</h3>
        <Button onClick={onLogPeriod} data-testid="button-log-period-history">
          <Plus className="h-4 w-4 mr-2" /> Log Period
        </Button>
      </div>

      {cycles.length === 0 ? (
        <Card className="text-center py-8" data-testid="card-no-cycles">
          <CardContent>
            <Droplets className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No cycles logged yet. Start by logging your most recent period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cycles.map((cycle) => (
            <Card key={cycle.id} data-testid={`cycle-entry-${cycle.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-pink-500" />
                      <span className="font-medium">{new Date(cycle.startDate).toLocaleDateString()}</span>
                      {cycle.endDate && <span className="text-muted-foreground text-sm">— {new Date(cycle.endDate).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {cycle.cycleLength && <span>Cycle: {cycle.cycleLength} days</span>}
                      {cycle.periodLength && <span>• Period: {cycle.periodLength} days</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{cycle.flowIntensity.replace("_", " ")}</Badge>
                      {cycle.symptoms.map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">{formatSymptom(s)}</Badge>
                      ))}
                    </div>
                    {cycle.notes && <p className="text-sm text-muted-foreground mt-1">{cycle.notes}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PregnancyTracking({ data, onAddWeight, onAddAppointment, onToggleMilestone }: {
  data?: DashboardData["pregnancy"];
  onAddWeight: () => void;
  onAddAppointment: () => void;
  onToggleMilestone: (m: string, c: boolean) => void;
}) {
  if (!data) {
    return (
      <Card className="text-center py-8" data-testid="card-no-pregnancy-tracking">
        <CardContent>
          <p className="text-muted-foreground">Set up your pregnancy profile from the Dashboard tab first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onAddWeight} data-testid="button-track-weight">
          <Scale className="h-4 w-4 mr-2" /> Log Weight
        </Button>
        <Button variant="outline" onClick={onAddAppointment} data-testid="button-track-appointment">
          <Calendar className="h-4 w-4 mr-2" /> Add Appointment
        </Button>
      </div>

      <Card data-testid="card-all-milestones">
        <CardHeader>
          <CardTitle className="text-base">All Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.pendingMilestones.map((m) => (
              <div key={m.milestone} className="flex items-center gap-2 p-2 rounded border" data-testid={`track-milestone-${m.milestone}`}>
                <Checkbox
                  checked={m.completed}
                  onCheckedChange={(checked) => onToggleMilestone(m.milestone, !!checked)}
                />
                <span className={`text-sm ${m.completed ? "line-through text-muted-foreground" : ""}`}>
                  {MILESTONE_LABELS[m.milestone] || m.milestone}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MenopauseTracking({ data, onLogSymptoms, onAddHrt }: {
  data?: DashboardData["menopause"];
  onLogSymptoms: () => void;
  onAddHrt: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onLogSymptoms} data-testid="button-track-symptoms">
          <Thermometer className="h-4 w-4 mr-2" /> Log Symptoms
        </Button>
        <Button variant="outline" onClick={onAddHrt} data-testid="button-track-hrt">
          <Pill className="h-4 w-4 mr-2" /> Add HRT Medication
        </Button>
      </div>

      {data?.topSymptoms && data.topSymptoms.length > 0 && (
        <Card data-testid="card-symptom-trends">
          <CardHeader>
            <CardTitle className="text-base">Symptom Trends (Last 2 Weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topSymptoms.map(s => (
                <div key={s.symptom} className="space-y-1" data-testid={`trend-${s.symptom}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatSymptom(s.symptom)}</span>
                    <span className="text-muted-foreground">{s.avgSeverity}/5</span>
                  </div>
                  <Progress value={s.avgSeverity * 20} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data?.activeHrt && data.activeHrt.length > 0 && (
        <Card data-testid="card-hrt-medications">
          <CardHeader>
            <CardTitle className="text-base">Current HRT Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.activeHrt.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded border" data-testid={`hrt-${m.id}`}>
                  <Pill className="h-5 w-5 text-purple-500 shrink-0" />
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.dosage} • Since {new Date(m.startDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScreeningsPanel({ screenings, lifeStage, onAddScreening }: { screenings: DashboardData["screenings"]; lifeStage: LifeStage; onAddScreening: () => void }) {
  const statusColors: Record<string, string> = {
    up_to_date: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    due_soon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    not_scheduled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recommended Screenings</h3>
        {(lifeStage === "menopause" || lifeStage === "postmenopause") && (
          <Button variant="outline" onClick={onAddScreening} data-testid="button-record-screening">
            <Plus className="h-4 w-4 mr-2" /> Record Screening
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {screenings.map((s, i) => (
          <Card key={i} data-testid={`screening-card-${i}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                <Badge className={`text-xs ${statusColors[s.status] || ""}`} variant="secondary" data-testid={`screening-status-${i}`}>
                  {s.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {s.lastDate && <p>Last: {new Date(s.lastDate).toLocaleDateString()}</p>}
                {s.nextDue && <p>Next due: {new Date(s.nextDue).toLocaleDateString()}</p>}
                {!s.lastDate && !s.nextDue && <p>Not yet scheduled — discuss with your provider</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EducationPanel({ content, lifeStage }: { content: EducationalContent[]; lifeStage: LifeStage }) {
  const categories = [...new Set(content.map(c => c.category))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Educational Resources</h3>
      </div>

      <Alert className="border-pink-200 bg-pink-50/50 dark:bg-pink-950/10" data-testid="education-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {NO_ADVICE_DISCLAIMER}
        </AlertDescription>
      </Alert>

      {categories.map(cat => (
        <div key={cat} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.filter(c => c.category === cat).map((item, i) => (
              <Card key={i} data-testid={`education-card-${i}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogPeriodDialog({ open, onClose, form, setForm, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  form: { startDate: string; endDate: string; flowIntensity: FlowIntensity; symptoms: MenstrualSymptom[]; notes: string };
  setForm: (fn: (prev: typeof form) => typeof form) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="log-period-dialog">
        <DialogHeader>
          <DialogTitle>Log Period</DialogTitle>
          <DialogDescription>Record the details of your menstrual period.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="womens-health-start-date-2">Start Date *</Label><Input id="womens-health-start-date-2" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} data-testid="input-period-start" /></div>
            <div><Label htmlFor="womens-health-end-date">End Date</Label><Input id="womens-health-end-date" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} data-testid="input-period-end" /></div>
          </div>

          <div>
            <FieldCaption>Flow Intensity</FieldCaption>
            <div className="flex gap-2 mt-1">
              {FLOW_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={form.flowIntensity === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm(p => ({ ...p, flowIntensity: opt.value }))}
                  className="flex-1 text-xs"
                  data-testid={`button-flow-${opt.value}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="womens-health-symptoms">Symptoms</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {MENSTRUAL_SYMPTOMS.map(s => (
                <div key={s.value} className="flex items-center gap-2">
                  <Checkbox id="womens-health-symptoms"
                    checked={form.symptoms.includes(s.value)}
                    onCheckedChange={(checked) => {
                      setForm(p => ({
                        ...p,
                        symptoms: checked ? [...p.symptoms, s.value] : p.symptoms.filter(x => x !== s.value),
                      }));
                    }}
                    data-testid={`checkbox-period-symptom-${s.value}`}
                  />
                  <span className="text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div><Label htmlFor="womens-health-notes-4">Notes</Label><Textarea id="womens-health-notes-4" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." data-testid="input-period-notes" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-period">Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.startDate || isPending} data-testid="button-save-period">
            {isPending ? "Saving..." : "Save Period"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
