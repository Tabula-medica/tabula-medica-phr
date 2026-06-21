import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Activity,
  Heart,
  Thermometer,
  Scale,
  Droplets,
  Wind,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Watch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Brain,
  ClipboardCheck,
  Calendar,
  Info,
  Stethoscope,
  Dumbbell,
  HeartPulse,
} from "lucide-react";

const VITAL_TYPES = [
  { id: "blood_pressure", name: "Blood Pressure", icon: Activity, unit: "mmHg", color: "text-rose-500 bg-rose-500/10" },
  { id: "glucose", name: "Blood Glucose", icon: Droplets, unit: "mg/dL", color: "text-amber-500 bg-amber-500/10" },
  { id: "weight", name: "Weight", icon: Scale, unit: "lbs", color: "text-blue-500 bg-blue-500/10" },
  { id: "temperature", name: "Temperature", icon: Thermometer, unit: "°F", color: "text-orange-500 bg-orange-500/10" },
  { id: "pulse_ox", name: "Oxygen Saturation", icon: Wind, unit: "%", color: "text-cyan-500 bg-cyan-500/10" },
  { id: "heart_rate", name: "Heart Rate", icon: Heart, unit: "bpm", color: "text-pink-500 bg-pink-500/10" },
  { id: "respiratory_rate", name: "Respiratory Rate", icon: Wind, unit: "breaths/min", color: "text-teal-500 bg-teal-500/10" },
];

const SEVERITY_LEVELS = [
  { value: "mild", label: "Mild", color: "bg-green-500" },
  { value: "moderate", label: "Moderate", color: "bg-yellow-500" },
  { value: "severe", label: "Severe", color: "bg-red-500" },
];

function VitalCard({ vital, referenceRanges }: { vital: any; referenceRanges: any }) {
  const vitalType = VITAL_TYPES.find(t => t.id === vital.type);
  const Icon = vitalType?.icon || Activity;
  const range = referenceRanges?.[vital.type];

  const getTrendIcon = (trend: string) => {
    if (trend === "improving") return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const isAbnormal = vital.flags?.isAbnormal;
  const displayValue = vital.type === "blood_pressure" && vital.secondaryValue 
    ? `${vital.value}/${vital.secondaryValue}` 
    : vital.value;

  return (
    <Card className={`relative overflow-hidden transition-all hover-elevate ${isAbnormal ? 'border-amber-500/50' : ''}`} data-testid={`card-vital-${vital.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`p-2 rounded-lg ${vitalType?.color || 'bg-primary/10 text-primary'}`}>
            <Icon className="h-5 w-5" />
          </div>
          {vital.flags?.trend && (
            <Badge variant="outline" className="text-xs gap-1" data-testid={`badge-trend-${vital.id}`}>
              {getTrendIcon(vital.flags.trend)}
              {vital.flags.trend}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">{vitalType?.name || vital.type}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold" data-testid={`text-vital-value-${vital.id}`}>{displayValue}</span>
            <span className="text-sm text-muted-foreground">{vital.unit}</span>
          </div>
          {range && (
            <p className="text-xs text-muted-foreground mt-1">
              Normal: {range.min}-{range.max} {range.unit}
            </p>
          )}
        </div>
        {isAbnormal && (
          <Badge variant="outline" className="mt-2 text-amber-600 border-amber-500/50 bg-amber-500/10" data-testid={`badge-abnormal-${vital.id}`}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            Outside normal range
          </Badge>
        )}
        <p className="text-xs text-muted-foreground mt-2" data-testid={`text-vital-date-${vital.id}`}>
          {new Date(vital.timestamp).toLocaleDateString()} at{" "}
          {new Date(vital.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </CardContent>
    </Card>
  );
}

function AddVitalDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [vitalType, setVitalType] = useState("blood_pressure");
  const [value, setValue] = useState("");
  const [secondaryValue, setSecondaryValue] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/patient-health/vitals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health/vitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health/summary"] });
      toast({ title: "Vital recorded", description: "Your vital has been saved successfully." });
      setOpen(false);
      setValue("");
      setSecondaryValue("");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save vital.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) {
      toast({ title: "Invalid value", description: "Please enter a valid number.", variant: "destructive" });
      return;
    }
    const data: any = {
      type: vitalType,
      value: parsedValue,
      unit: VITAL_TYPES.find(t => t.id === vitalType)?.unit || "",
      source: "manual",
    };
    if (vitalType === "blood_pressure" && secondaryValue) {
      const parsedSecondary = parseFloat(secondaryValue);
      if (isNaN(parsedSecondary)) {
        toast({ title: "Invalid value", description: "Please enter a valid diastolic value.", variant: "destructive" });
        return;
      }
      data.secondaryValue = parsedSecondary;
    }
    mutation.mutate(data);
  };

  const selectedType = VITAL_TYPES.find(t => t.id === vitalType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-vital" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Vital
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Record Vital Sign
          </DialogTitle>
          <DialogDescription>
            Enter your vital measurement. All data is stored securely.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Vital Type</Label>
            <Select value={vitalType} onValueChange={setVitalType}>
              <SelectTrigger data-testid="select-vital-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VITAL_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{vitalType === "blood_pressure" ? "Systolic" : "Value"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Enter value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  data-testid="input-vital-value"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedType?.unit}
                </span>
              </div>
            </div>
            {vitalType === "blood_pressure" && (
              <div className="space-y-2">
                <Label>Diastolic</Label>
                <Input
                  type="number"
                  placeholder="Enter value"
                  value={secondaryValue}
                  onChange={(e) => setSecondaryValue(e.target.value)}
                  data-testid="input-vital-secondary"
                />
              </div>
            )}
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={!value || mutation.isPending}
            className="w-full"
            data-testid="button-save-vital"
          >
            {mutation.isPending ? "Saving..." : "Save Vital"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogSymptomDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [triggers, setTriggers] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/patient-health/symptoms", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health/symptoms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-health/summary"] });
      toast({ title: "Symptom logged", description: "Your symptom has been recorded." });
      setOpen(false);
      setSymptom("");
      setSeverity("mild");
      setDuration("");
      setLocation("");
      setTriggers("");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log symptom.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      symptom,
      severity,
      duration,
      location,
      triggers: triggers.split(",").map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-log-symptom" className="gap-2">
          <Stethoscope className="h-4 w-4" />
          Log Symptom
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Log Symptom
          </DialogTitle>
          <DialogDescription>
            Track your symptoms to identify patterns over time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>What symptom are you experiencing?</Label>
            <Input
              placeholder="e.g., Headache, Fatigue, Nausea"
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              data-testid="input-symptom-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Severity</Label>
            <div className="flex gap-2 flex-wrap">
              {SEVERITY_LEVELS.map(level => (
                <Button
                  key={level.value}
                  variant={severity === level.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSeverity(level.value)}
                  data-testid={`button-severity-${level.value}`}
                >
                  <div className={`h-2 w-2 rounded-full mr-2 ${level.color}`} />
                  {level.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input
                placeholder="e.g., 2 hours"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                data-testid="input-symptom-duration"
              />
            </div>
            <div className="space-y-2">
              <Label>Location (if applicable)</Label>
              <Input
                placeholder="e.g., temples, lower back"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                data-testid="input-symptom-location"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Possible triggers (comma-separated)</Label>
            <Input
              placeholder="e.g., stress, lack of sleep, weather"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
              data-testid="input-symptom-triggers"
            />
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={!symptom || mutation.isPending}
            className="w-full"
            data-testid="button-save-symptom"
          >
            {mutation.isPending ? "Saving..." : "Log Symptom"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdherenceCard({ score, tasks }: { score: any; tasks: any[] }) {
  const percentage = score?.score || 0;

  return (
    <Card className="relative overflow-hidden" data-testid="card-adherence">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary" 
           style={{ width: `${percentage}%` }} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Care Plan Adherence
          </CardTitle>
          <Badge variant={percentage >= 80 ? "default" : percentage >= 60 ? "secondary" : "destructive"}>
            {percentage}%
          </Badge>
        </div>
        <CardDescription>Your progress on care plan tasks this week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{score?.completed || 0} completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{(score?.total || 0) - (score?.completed || 0)} remaining</span>
            </div>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-sm text-muted-foreground">{score?.feedback}</p>
          {score?.byCategory && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {Object.entries(score.byCategory).map(([category, value]: [string, any]) => (
                <div key={category} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground capitalize">{category}</p>
                  <p className="text-lg font-semibold">{value}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsightsCard({ analysis }: { analysis: any }) {
  if (!analysis) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-ai-insights">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Health Insights
          <Badge variant="outline" className="ml-2 text-xs" data-testid="badge-educational">Educational Only</Badge>
        </CardTitle>
        <CardDescription>Pattern analysis based on your tracked data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysis.vitalsTrends && analysis.vitalsTrends.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Vital Trends</p>
            <div className="flex flex-wrap gap-2">
              {analysis.vitalsTrends.map((trend: any, i: number) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {trend.trend === "improving" && <TrendingUp className="h-3 w-3 text-green-500" />}
                  {trend.trend === "declining" && <TrendingDown className="h-3 w-3 text-red-500" />}
                  {trend.trend === "stable" && <Minus className="h-3 w-3" />}
                  {trend.type}: {trend.trend}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {analysis.symptomPatterns && analysis.symptomPatterns.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Symptom Patterns</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.symptomPatterns.slice(0, 3).map((pattern: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  {pattern}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.correlations && analysis.correlations.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Potential Correlations</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.correlations.slice(0, 2).map((corr: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  {corr}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Alert className="bg-muted/50 border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {analysis.noCdsDisclaimer || "This is educational content only and is not medical advice. Always consult your healthcare provider."}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function WearablesCard() {
  const { data: devicesData, isLoading } = useQuery<{ devices?: any[]; success?: boolean; noCdsDisclaimer?: string }>({
    queryKey: ["/api/wearables/devices"],
  });

  const devices = devicesData?.devices || [];

  return (
    <Card data-testid="card-wearables">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Watch className="h-5 w-5 text-primary" />
          Connected Devices
        </CardTitle>
        <CardDescription>Wearable devices syncing health data</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-4">
            <Watch className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No devices connected</p>
            <Button variant="outline" size="sm" className="mt-2">
              Connect Device
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device: any) => (
              <div key={device.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${device.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-muted'}`}>
                    <Watch className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{device.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last sync: {new Date(device.lastSync).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant={device.status === 'connected' ? 'default' : 'secondary'}>
                  {device.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PatientHealthTracking() {
  useSEO({
    title: "Health Tracking | Tabula Medica",
    description: "Track your vitals, symptoms, and care plan adherence with AI-powered health insights.",
  });

  const { data: vitalsData, isLoading: vitalsLoading, refetch: refetchVitals } = useQuery<{ data?: any[]; success?: boolean }>({
    queryKey: ["/api/patient-health/vitals"],
  });

  const { data: referenceData } = useQuery<{ data?: Record<string, any>; success?: boolean }>({
    queryKey: ["/api/patient-health/reference-ranges"],
  });

  const { data: symptomsData, isLoading: symptomsLoading } = useQuery<{ data?: any[]; success?: boolean }>({
    queryKey: ["/api/patient-health/symptoms"],
  });

  const { data: adherenceScore } = useQuery<{ data?: any; success?: boolean }>({
    queryKey: ["/api/patient-health/adherence/score"],
  });

  const { data: tasksData } = useQuery<{ data?: any[]; success?: boolean }>({
    queryKey: ["/api/patient-health/care-plan/tasks"],
  });

  const { data: analysisData, isLoading: analysisLoading } = useQuery<{ data?: any; success?: boolean }>({
    queryKey: ["/api/patient-health/analysis"],
  });

  const { data: summaryData } = useQuery<{ data?: any; success?: boolean }>({
    queryKey: ["/api/patient-health/summary"],
  });

  const vitals = vitalsData?.data || [];
  const referenceRanges = referenceData?.data || {};
  const symptoms = symptomsData?.data || [];
  const tasks = tasksData?.data || [];
  const analysis = analysisData?.data;
  const summary = summaryData?.data;

  const handleSuccess = () => {
    refetchVitals();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <HeartPulse className="h-8 w-8 text-primary" />
            Health Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Record vitals, track symptoms, and monitor your care plan progress
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LogSymptomDialog onSuccess={handleSuccess} />
          <AddVitalDialog onSuccess={handleSuccess} />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.vitalsCount || 0}</p>
                <p className="text-xs text-muted-foreground">Vitals Recorded</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.symptomsCount || 0}</p>
                <p className="text-xs text-muted-foreground">Symptoms Logged</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.adherenceScore || 0}%</p>
                <p className="text-xs text-muted-foreground">Adherence Score</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summary.lastVitalDate ? new Date(summary.lastVitalDate).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">Last Recording</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="vitals" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vitals" data-testid="tab-vitals">
                <Activity className="h-4 w-4 mr-2" />
                Vitals
              </TabsTrigger>
              <TabsTrigger value="symptoms" data-testid="tab-symptoms">
                <Stethoscope className="h-4 w-4 mr-2" />
                Symptoms
              </TabsTrigger>
              <TabsTrigger value="adherence" data-testid="tab-adherence">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Care Plan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vitals" className="mt-4">
              {vitalsLoading ? (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : vitals.length === 0 ? (
                <Card className="p-8 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No vitals recorded yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start tracking your health by recording your first vital sign.
                  </p>
                  <AddVitalDialog onSuccess={handleSuccess} />
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {vitals.slice(0, 12).map((vital: any) => (
                    <VitalCard key={vital.id} vital={vital} referenceRanges={referenceRanges} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="symptoms" className="mt-4">
              {symptomsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : symptoms.length === 0 ? (
                <Card className="p-8 text-center">
                  <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No symptoms logged</h3>
                  <p className="text-muted-foreground mb-4">
                    Track your symptoms to identify patterns and share with your care team.
                  </p>
                  <LogSymptomDialog onSuccess={handleSuccess} />
                </Card>
              ) : (
                <div className="space-y-3">
                  {symptoms.map((symptom: any) => {
                    const severityLevel = SEVERITY_LEVELS.find(s => s.value === symptom.severity);
                    return (
                      <Card key={symptom.id} className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium">{symptom.symptom}</h4>
                              <Badge variant="outline" className="gap-1">
                                <div className={`h-2 w-2 rounded-full ${severityLevel?.color}`} />
                                {symptom.severity}
                              </Badge>
                            </div>
                            {symptom.location && (
                              <p className="text-sm text-muted-foreground">Location: {symptom.location}</p>
                            )}
                            {symptom.duration && (
                              <p className="text-sm text-muted-foreground">Duration: {symptom.duration}</p>
                            )}
                            {symptom.triggers && symptom.triggers.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-2">
                                <span className="text-xs text-muted-foreground">Triggers:</span>
                                {symptom.triggers.map((trigger: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {trigger}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(symptom.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="adherence" className="mt-4 space-y-4">
              <AdherenceCard score={adherenceScore?.data} tasks={tasks} />
              {tasks.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Today's Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tasks.slice(0, 5).map((task: any) => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${task.priority === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-muted'}`}>
                              {task.category === 'monitoring' && <Activity className="h-4 w-4" />}
                              {task.category === 'medication' && <Droplets className="h-4 w-4" />}
                              {task.category === 'exercise' && <Dumbbell className="h-4 w-4" />}
                              {!['monitoring', 'medication', 'exercise'].includes(task.category) && <Clock className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{task.description}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {task.frequency}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {analysisLoading ? (
            <Skeleton className="h-64" />
          ) : analysis ? (
            <AIInsightsCard analysis={analysis} />
          ) : null}
          <WearablesCard />
        </div>
      </div>

      <Alert className="bg-muted/50 border-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>Educational Content Only</AlertTitle>
        <AlertDescription>
          All health insights and pattern analysis are for educational purposes only and do not constitute medical advice. 
          Always consult your healthcare provider for medical guidance and treatment decisions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
