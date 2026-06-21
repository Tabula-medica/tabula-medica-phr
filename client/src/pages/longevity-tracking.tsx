import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, Heart, Brain, Dumbbell, Moon, Apple, Droplets, Thermometer,
  TrendingUp, TrendingDown, Minus, Calendar, Plus, X, Info, Target,
  Scale, Eye, Zap, Leaf, Sun, Wind, Timer, BarChart3, LineChart,
  Clock, Shield, Sparkles, CheckCircle2, AlertTriangle,
} from "lucide-react";

interface BiomarkerEntry {
  id: string;
  name: string;
  value: string;
  unit: string;
  date: string;
  category: string;
  optimalRange: string;
  status: "optimal" | "borderline" | "concern" | "unknown";
}

interface LongevityMetric {
  id: string;
  category: string;
  metric: string;
  value: string;
  date: string;
  notes: string;
}

interface WellnessLog {
  id: string;
  date: string;
  sleep: string;
  exercise: string;
  exerciseMinutes: string;
  mood: string;
  stress: string;
  hydration: string;
  fasting: string;
  supplements: string;
  notes: string;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const BIOMARKER_CATEGORIES = [
  { key: "metabolic", label: "Metabolic", icon: Zap },
  { key: "cardiovascular", label: "Cardiovascular", icon: Heart },
  { key: "inflammatory", label: "Inflammatory", icon: Thermometer },
  { key: "hormonal", label: "Hormonal", icon: Activity },
  { key: "nutritional", label: "Nutritional", icon: Apple },
  { key: "organ", label: "Organ Function", icon: Shield },
];

const COMMON_BIOMARKERS = [
  { name: "Fasting Glucose", unit: "mg/dL", category: "metabolic", optimal: "70-99" },
  { name: "HbA1c", unit: "%", category: "metabolic", optimal: "< 5.7" },
  { name: "Fasting Insulin", unit: "µIU/mL", category: "metabolic", optimal: "2-6" },
  { name: "HOMA-IR", unit: "", category: "metabolic", optimal: "< 1.0" },
  { name: "Total Cholesterol", unit: "mg/dL", category: "cardiovascular", optimal: "< 200" },
  { name: "LDL Cholesterol", unit: "mg/dL", category: "cardiovascular", optimal: "< 100" },
  { name: "HDL Cholesterol", unit: "mg/dL", category: "cardiovascular", optimal: "> 60" },
  { name: "Triglycerides", unit: "mg/dL", category: "cardiovascular", optimal: "< 150" },
  { name: "ApoB", unit: "mg/dL", category: "cardiovascular", optimal: "< 80" },
  { name: "Lp(a)", unit: "nmol/L", category: "cardiovascular", optimal: "< 75" },
  { name: "hs-CRP", unit: "mg/L", category: "inflammatory", optimal: "< 1.0" },
  { name: "Homocysteine", unit: "µmol/L", category: "inflammatory", optimal: "< 10" },
  { name: "IL-6", unit: "pg/mL", category: "inflammatory", optimal: "< 1.8" },
  { name: "TNF-alpha", unit: "pg/mL", category: "inflammatory", optimal: "< 8.1" },
  { name: "Testosterone (Total)", unit: "ng/dL", category: "hormonal", optimal: "varies" },
  { name: "Free Testosterone", unit: "pg/mL", category: "hormonal", optimal: "varies" },
  { name: "DHEA-S", unit: "µg/dL", category: "hormonal", optimal: "varies by age" },
  { name: "Cortisol (AM)", unit: "µg/dL", category: "hormonal", optimal: "6-18" },
  { name: "TSH", unit: "mIU/L", category: "hormonal", optimal: "0.5-2.5" },
  { name: "Free T3", unit: "pg/mL", category: "hormonal", optimal: "3.0-4.0" },
  { name: "Free T4", unit: "ng/dL", category: "hormonal", optimal: "1.0-1.5" },
  { name: "IGF-1", unit: "ng/mL", category: "hormonal", optimal: "varies by age" },
  { name: "Vitamin D (25-OH)", unit: "ng/mL", category: "nutritional", optimal: "40-60" },
  { name: "Vitamin B12", unit: "pg/mL", category: "nutritional", optimal: "500-1000" },
  { name: "Ferritin", unit: "ng/mL", category: "nutritional", optimal: "40-150" },
  { name: "Magnesium (RBC)", unit: "mg/dL", category: "nutritional", optimal: "5.0-6.5" },
  { name: "Omega-3 Index", unit: "%", category: "nutritional", optimal: "> 8" },
  { name: "Zinc", unit: "µg/dL", category: "nutritional", optimal: "80-120" },
  { name: "GFR", unit: "mL/min", category: "organ", optimal: "> 90" },
  { name: "Cystatin C", unit: "mg/L", category: "organ", optimal: "0.5-1.0" },
  { name: "ALT", unit: "U/L", category: "organ", optimal: "< 25" },
  { name: "AST", unit: "U/L", category: "organ", optimal: "< 25" },
  { name: "GGT", unit: "U/L", category: "organ", optimal: "< 30" },
  { name: "Uric Acid", unit: "mg/dL", category: "organ", optimal: "< 5.5" },
];

const LONGEVITY_CATEGORIES = [
  {
    key: "body_composition",
    label: "Body Composition",
    icon: Scale,
    metrics: [
      "Body Weight", "BMI", "Body Fat %", "Visceral Fat", "Lean Muscle Mass",
      "Waist Circumference", "Waist-to-Hip Ratio", "DEXA Scan",
    ],
  },
  {
    key: "cardiovascular_fitness",
    label: "Cardiovascular Fitness",
    icon: Heart,
    metrics: [
      "VO2 Max", "Resting Heart Rate", "Heart Rate Recovery", "Blood Pressure (Systolic)",
      "Blood Pressure (Diastolic)", "Coronary Artery Calcium Score", "Pulse Wave Velocity",
      "ABI (Ankle-Brachial Index)",
    ],
  },
  {
    key: "strength_mobility",
    label: "Strength & Mobility",
    icon: Dumbbell,
    metrics: [
      "Grip Strength (Left)", "Grip Strength (Right)", "Dead Hang Time",
      "Sit-to-Stand (30s)", "Single Leg Balance", "Push-ups (max)",
      "Plank Hold", "Flexibility (Sit & Reach)",
    ],
  },
  {
    key: "cognitive",
    label: "Cognitive Health",
    icon: Brain,
    metrics: [
      "MoCA Score", "Reaction Time", "Memory Test Score", "Processing Speed",
      "Executive Function", "Sleep Quality (Pittsburgh PSQI)", "PHQ-9 (Depression Screen)",
      "GAD-7 (Anxiety Screen)",
    ],
  },
  {
    key: "biological_age",
    label: "Biological Age",
    icon: Clock,
    metrics: [
      "Chronological Age", "Biological Age (estimate)", "Telomere Length",
      "DNA Methylation Age", "GlycanAge", "Phenotypic Age (PhenoAge)",
      "Pace of Aging (DunedinPACE)",
    ],
  },
  {
    key: "sleep_recovery",
    label: "Sleep & Recovery",
    icon: Moon,
    metrics: [
      "Total Sleep (hours)", "Deep Sleep %", "REM Sleep %", "Sleep Latency (min)",
      "HRV (RMSSD)", "Respiratory Rate (night)", "SpO2 (night avg)",
      "Wake After Sleep Onset (min)",
    ],
  },
];

const SUPPLEMENT_OPTIONS = [
  "Vitamin D3", "Omega-3 / Fish Oil", "Magnesium (Glycinate)", "CoQ10 / Ubiquinol",
  "NMN / NR (NAD+)", "Resveratrol", "Metformin (Rx)", "Rapamycin (Rx)",
  "Creatine Monohydrate", "Curcumin / Turmeric", "Berberine", "Ashwagandha",
  "Lion's Mane", "Melatonin", "Probiotics", "Collagen", "Alpha-Lipoic Acid",
  "Taurine", "Glycine", "Spermidine", "Fisetin", "Quercetin",
];

export default function LongevityTracking() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("biomarkers");
  const [biomarkers, setBiomarkers] = useState<BiomarkerEntry[]>([]);
  const [longevityMetrics, setLongevityMetrics] = useState<LongevityMetric[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddBiomarker, setShowAddBiomarker] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [newBiomarker, setNewBiomarker] = useState<Partial<BiomarkerEntry>>({});
  const [newMetric, setNewMetric] = useState<Partial<LongevityMetric>>({});
  const [newLog, setNewLog] = useState<Partial<WellnessLog>>({
    date: new Date().toISOString().split("T")[0],
    sleep: "", exercise: "", exerciseMinutes: "", mood: "", stress: "",
    hydration: "", fasting: "", supplements: "", notes: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("tabula_longevity_data");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.biomarkers) setBiomarkers(data.biomarkers);
        if (data.longevityMetrics) setLongevityMetrics(data.longevityMetrics);
        if (data.wellnessLogs) setWellnessLogs(data.wellnessLogs);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tabula_longevity_data", JSON.stringify({
      biomarkers, longevityMetrics, wellnessLogs,
    }));
  }, [biomarkers, longevityMetrics, wellnessLogs]);

  const addBiomarker = (template?: typeof COMMON_BIOMARKERS[0]) => {
    const entry: BiomarkerEntry = {
      id: uid(),
      name: template?.name || newBiomarker.name || "",
      value: newBiomarker.value || "",
      unit: template?.unit || newBiomarker.unit || "",
      date: newBiomarker.date || new Date().toISOString().split("T")[0],
      category: template?.category || newBiomarker.category || "metabolic",
      optimalRange: template?.optimal || newBiomarker.optimalRange || "",
      status: "unknown",
    };
    if (!entry.name) return;
    setBiomarkers(prev => [entry, ...prev]);
    setNewBiomarker({});
    setShowAddBiomarker(false);
    toast({ title: "Biomarker Added", description: `${entry.name} recorded.` });
  };

  const addLongevityMetric = () => {
    const entry: LongevityMetric = {
      id: uid(),
      category: newMetric.category || "",
      metric: newMetric.metric || "",
      value: newMetric.value || "",
      date: newMetric.date || new Date().toISOString().split("T")[0],
      notes: newMetric.notes || "",
    };
    if (!entry.metric || !entry.value) return;
    setLongevityMetrics(prev => [entry, ...prev]);
    setNewMetric({});
    setShowAddMetric(false);
    toast({ title: "Metric Recorded", description: `${entry.metric}: ${entry.value}` });
  };

  const addWellnessLog = () => {
    const entry: WellnessLog = {
      id: uid(),
      date: newLog.date || new Date().toISOString().split("T")[0],
      sleep: newLog.sleep || "",
      exercise: newLog.exercise || "",
      exerciseMinutes: newLog.exerciseMinutes || "",
      mood: newLog.mood || "",
      stress: newLog.stress || "",
      hydration: newLog.hydration || "",
      fasting: newLog.fasting || "",
      supplements: newLog.supplements || "",
      notes: newLog.notes || "",
    };
    setWellnessLogs(prev => [entry, ...prev]);
    setNewLog({
      date: new Date().toISOString().split("T")[0],
      sleep: "", exercise: "", exerciseMinutes: "", mood: "", stress: "",
      hydration: "", fasting: "", supplements: "", notes: "",
    });
    toast({ title: "Daily Log Saved", description: `Wellness log for ${entry.date} recorded.` });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-green-600 dark:text-green-400";
      case "borderline": return "text-yellow-600 dark:text-yellow-400";
      case "concern": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "optimal": return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Optimal</Badge>;
      case "borderline": return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">Borderline</Badge>;
      case "concern": return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Needs Attention</Badge>;
      default: return <Badge variant="outline">Not Rated</Badge>;
    }
  };

  const filteredBiomarkers = selectedCategory === "all"
    ? biomarkers
    : biomarkers.filter(b => b.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 max-w-6xl mx-auto" data-testid="longevity-tracking-page">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <Activity className="w-7 h-7 text-primary" />
          Longevity Tracking
        </h1>
        <p className="text-muted-foreground">
          Track biomarkers, fitness metrics, and daily wellness for proactive health optimization.
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="w-4 h-4" />
        <AlertDescription>
          This module is for personal health tracking only. All data is stored locally and is not medical advice.
          Always consult your healthcare provider for interpretation of lab results and health metrics.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="biomarkers" className="text-xs md:text-sm py-2" data-testid="tab-biomarkers">
            <Droplets className="w-4 h-4 mr-1 hidden md:inline" /> Biomarkers
          </TabsTrigger>
          <TabsTrigger value="fitness" className="text-xs md:text-sm py-2" data-testid="tab-fitness">
            <Dumbbell className="w-4 h-4 mr-1 hidden md:inline" /> Fitness & Body
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs md:text-sm py-2" data-testid="tab-daily">
            <Sun className="w-4 h-4 mr-1 hidden md:inline" /> Daily Log
          </TabsTrigger>
          <TabsTrigger value="supplements" className="text-xs md:text-sm py-2" data-testid="tab-supplements">
            <Leaf className="w-4 h-4 mr-1 hidden md:inline" /> Supplements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biomarkers" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Lab Biomarkers</h2>
              <p className="text-sm text-muted-foreground">Track key blood markers over time</p>
            </div>
            <Button onClick={() => setShowAddBiomarker(true)} data-testid="button-add-biomarker">
              <Plus className="w-4 h-4 mr-2" /> Add Result
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory("all")}
              data-testid="filter-all"
            >
              All
            </Badge>
            {BIOMARKER_CATEGORIES.map(cat => (
              <Badge
                key={cat.key}
                variant={selectedCategory === cat.key ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(cat.key)}
                data-testid={`filter-${cat.key}`}
              >
                <cat.icon className="w-3 h-3 mr-1" /> {cat.label}
              </Badge>
            ))}
          </div>

          {showAddBiomarker && (
            <Card className="border-primary/30">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Add Biomarker Result</CardTitle>
                <CardDescription>Quick-add from common markers or enter custom</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_BIOMARKERS.filter(b => selectedCategory === "all" || b.category === selectedCategory).slice(0, 12).map(b => (
                    <Badge
                      key={b.name}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 text-xs"
                      onClick={() => setNewBiomarker(prev => ({ ...prev, name: b.name, unit: b.unit, category: b.category, optimalRange: b.optimal }))}
                      data-testid={`quick-add-${b.name.replace(/\s/g, "-").toLowerCase()}`}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {b.name}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Biomarker Name</Label>
                    <Input
                      value={newBiomarker.name || ""}
                      onChange={e => setNewBiomarker(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., HbA1c"
                      data-testid="input-biomarker-name"
                    />
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input
                      value={newBiomarker.value || ""}
                      onChange={e => setNewBiomarker(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="e.g., 5.4"
                      data-testid="input-biomarker-value"
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input
                      value={newBiomarker.unit || ""}
                      onChange={e => setNewBiomarker(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="e.g., %"
                      data-testid="input-biomarker-unit"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newBiomarker.date || new Date().toISOString().split("T")[0]}
                      onChange={e => setNewBiomarker(prev => ({ ...prev, date: e.target.value }))}
                      data-testid="input-biomarker-date"
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={newBiomarker.category || "metabolic"}
                      onValueChange={v => setNewBiomarker(prev => ({ ...prev, category: v }))}
                    >
                      <SelectTrigger data-testid="select-biomarker-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BIOMARKER_CATEGORIES.map(c => (
                          <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={newBiomarker.status || "unknown"}
                      onValueChange={v => setNewBiomarker(prev => ({ ...prev, status: v as any }))}
                    >
                      <SelectTrigger data-testid="select-biomarker-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optimal">Optimal</SelectItem>
                        <SelectItem value="borderline">Borderline</SelectItem>
                        <SelectItem value="concern">Needs Attention</SelectItem>
                        <SelectItem value="unknown">Not Rated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => addBiomarker()} data-testid="button-save-biomarker">Save</Button>
                  <Button variant="outline" onClick={() => setShowAddBiomarker(false)} data-testid="button-cancel-biomarker">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredBiomarkers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Droplets className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No biomarker results yet</p>
                <p className="text-sm mt-1">Add your lab results to start tracking trends over time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredBiomarkers.map(b => (
                <Card key={b.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.date} · {BIOMARKER_CATEGORIES.find(c => c.key === b.category)?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-semibold ${getStatusColor(b.status)}`}>{b.value} {b.unit}</p>
                        {b.optimalRange && <p className="text-xs text-muted-foreground">Optimal: {b.optimalRange}</p>}
                      </div>
                      {getStatusBadge(b.status)}
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setBiomarkers(prev => prev.filter(x => x.id !== b.id))}
                        data-testid={`button-delete-biomarker-${b.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="bg-muted/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Longevity Biomarker Targets</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {COMMON_BIOMARKERS.slice(0, 12).map(b => (
                  <div key={b.name} className="flex justify-between py-1 border-b border-muted last:border-0">
                    <span className="text-muted-foreground">{b.name}</span>
                    <span className="font-medium">{b.optimal} {b.unit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fitness" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Fitness & Body Metrics</h2>
              <p className="text-sm text-muted-foreground">Track physical performance and body composition</p>
            </div>
            <Button onClick={() => setShowAddMetric(true)} data-testid="button-add-metric">
              <Plus className="w-4 h-4 mr-2" /> Add Measurement
            </Button>
          </div>

          {showAddMetric && (
            <Card className="border-primary/30">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Add Fitness / Body Metric</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={newMetric.category || ""}
                    onValueChange={v => setNewMetric(prev => ({ ...prev, category: v, metric: "" }))}
                  >
                    <SelectTrigger data-testid="select-metric-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {LONGEVITY_CATEGORIES.map(c => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newMetric.category && (
                  <div>
                    <Label>Metric</Label>
                    <Select
                      value={newMetric.metric || ""}
                      onValueChange={v => setNewMetric(prev => ({ ...prev, metric: v }))}
                    >
                      <SelectTrigger data-testid="select-metric-name"><SelectValue placeholder="Select metric" /></SelectTrigger>
                      <SelectContent>
                        {LONGEVITY_CATEGORIES.find(c => c.key === newMetric.category)?.metrics.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Value</Label>
                    <Input
                      value={newMetric.value || ""}
                      onChange={e => setNewMetric(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="e.g., 45.2"
                      data-testid="input-metric-value"
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newMetric.date || new Date().toISOString().split("T")[0]}
                      onChange={e => setNewMetric(prev => ({ ...prev, date: e.target.value }))}
                      data-testid="input-metric-date"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={newMetric.notes || ""}
                      onChange={e => setNewMetric(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional notes"
                      data-testid="input-metric-notes"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addLongevityMetric} data-testid="button-save-metric">Save</Button>
                  <Button variant="outline" onClick={() => setShowAddMetric(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {LONGEVITY_CATEGORIES.map(cat => {
              const catMetrics = longevityMetrics.filter(m => m.category === cat.key);
              return (
                <Card key={cat.key}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <cat.icon className="w-4 h-4 text-primary" /> {cat.label}
                    </CardTitle>
                    <CardDescription className="text-xs">{catMetrics.length} measurement{catMetrics.length !== 1 ? "s" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {catMetrics.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No measurements yet</p>
                    ) : (
                      catMetrics.slice(0, 5).map(m => (
                        <div key={m.id} className="flex justify-between items-center text-sm border-b border-muted pb-1 last:border-0">
                          <div>
                            <span className="font-medium text-xs">{m.metric}</span>
                            <span className="text-xs text-muted-foreground ml-2">{m.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs">{m.value}</span>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => setLongevityMetrics(prev => prev.filter(x => x.id !== m.id))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Daily Wellness Log</h2>
            <p className="text-sm text-muted-foreground">Track sleep, exercise, mood, and habits every day</p>
          </div>

          <Card className="border-primary/30">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Log Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</Label>
                  <Input
                    type="date"
                    value={newLog.date || ""}
                    onChange={e => setNewLog(prev => ({ ...prev, date: e.target.value }))}
                    data-testid="input-log-date"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Moon className="w-3 h-3" /> Sleep (hours)</Label>
                  <Select value={newLog.sleep || ""} onValueChange={v => setNewLog(prev => ({ ...prev, sleep: v }))}>
                    <SelectTrigger data-testid="select-sleep"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["< 5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9+"].map(h => (
                        <SelectItem key={h} value={h}>{h} hrs</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Dumbbell className="w-3 h-3" /> Exercise Type</Label>
                  <Select value={newLog.exercise || ""} onValueChange={v => setNewLog(prev => ({ ...prev, exercise: v }))}>
                    <SelectTrigger data-testid="select-exercise"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["None", "Walking", "Running", "Cycling", "Swimming", "Weights", "HIIT", "Yoga", "Sports", "Zone 2 Cardio", "Other"].map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Timer className="w-3 h-3" /> Minutes</Label>
                  <Input
                    type="number"
                    value={newLog.exerciseMinutes || ""}
                    onChange={e => setNewLog(prev => ({ ...prev, exerciseMinutes: e.target.value }))}
                    placeholder="30"
                    data-testid="input-exercise-minutes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Brain className="w-3 h-3" /> Mood</Label>
                  <Select value={newLog.mood || ""} onValueChange={v => setNewLog(prev => ({ ...prev, mood: v }))}>
                    <SelectTrigger data-testid="select-mood"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Excellent", "Good", "Okay", "Low", "Poor"].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Zap className="w-3 h-3" /> Stress Level</Label>
                  <Select value={newLog.stress || ""} onValueChange={v => setNewLog(prev => ({ ...prev, stress: v }))}>
                    <SelectTrigger data-testid="select-stress"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Very Low", "Low", "Moderate", "High", "Very High"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Droplets className="w-3 h-3" /> Hydration (glasses)</Label>
                  <Select value={newLog.hydration || ""} onValueChange={v => setNewLog(prev => ({ ...prev, hydration: v }))}>
                    <SelectTrigger data-testid="select-hydration"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["0-2", "3-4", "5-6", "7-8", "9-10", "10+"].map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Fasting Window</Label>
                  <Select value={newLog.fasting || ""} onValueChange={v => setNewLog(prev => ({ ...prev, fasting: v }))}>
                    <SelectTrigger data-testid="select-fasting"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["None", "12 hours", "14 hours", "16 hours (16:8)", "18 hours", "20 hours (OMAD)", "24+ hours", "Extended (36+)"].map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Supplements Taken Today</Label>
                <Input
                  value={newLog.supplements || ""}
                  onChange={e => setNewLog(prev => ({ ...prev, supplements: e.target.value }))}
                  placeholder="e.g., Vitamin D, Omega-3, Magnesium"
                  data-testid="input-supplements"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newLog.notes || ""}
                  onChange={e => setNewLog(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="How are you feeling? Any symptoms, observations, or wins?"
                  rows={2}
                  data-testid="input-daily-notes"
                />
              </div>

              <Button onClick={addWellnessLog} className="w-full md:w-auto" data-testid="button-save-daily-log">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Save Daily Log
              </Button>
            </CardContent>
          </Card>

          {wellnessLogs.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Recent Logs</h3>
              {wellnessLogs.slice(0, 14).map(log => (
                <Card key={log.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{log.date}</span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setWellnessLogs(prev => prev.filter(x => x.id !== log.id))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {log.sleep && <Badge variant="outline"><Moon className="w-3 h-3 mr-1" /> {log.sleep} hrs</Badge>}
                      {log.exercise && <Badge variant="outline"><Dumbbell className="w-3 h-3 mr-1" /> {log.exercise} {log.exerciseMinutes && `(${log.exerciseMinutes}m)`}</Badge>}
                      {log.mood && <Badge variant="outline"><Brain className="w-3 h-3 mr-1" /> {log.mood}</Badge>}
                      {log.stress && <Badge variant="outline"><Zap className="w-3 h-3 mr-1" /> Stress: {log.stress}</Badge>}
                      {log.hydration && <Badge variant="outline"><Droplets className="w-3 h-3 mr-1" /> {log.hydration} glasses</Badge>}
                      {log.fasting && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> {log.fasting}</Badge>}
                    </div>
                    {log.supplements && <p className="text-xs text-muted-foreground mt-1"><Leaf className="w-3 h-3 inline mr-1" /> {log.supplements}</p>}
                    {log.notes && <p className="text-xs text-muted-foreground mt-1 italic">{log.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="supplements" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Supplement & Protocol Tracker</h2>
            <p className="text-sm text-muted-foreground">Track supplements, medications, and longevity protocols</p>
          </div>

          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Supplements are not regulated by the FDA. Always discuss with your healthcare provider before starting any supplement regimen, especially if you take prescription medications.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Foundational", items: ["Vitamin D3", "Omega-3 / Fish Oil", "Magnesium (Glycinate)", "CoQ10 / Ubiquinol", "Probiotics", "Zinc"] },
              { title: "Longevity-Focused", items: ["NMN / NR (NAD+)", "Resveratrol", "Spermidine", "Fisetin", "Quercetin", "Alpha-Lipoic Acid"] },
              { title: "Performance", items: ["Creatine Monohydrate", "Taurine", "Glycine", "Collagen", "Lion's Mane", "Ashwagandha"] },
              { title: "Prescription (Rx)", items: ["Metformin (Rx)", "Rapamycin (Rx)", "Low-dose Aspirin (Rx)", "Testosterone (Rx)", "GLP-1 Agonist (Rx)"] },
              { title: "Metabolic Support", items: ["Berberine", "Curcumin / Turmeric", "Chromium", "Cinnamon Extract", "Apple Cider Vinegar"] },
              { title: "Sleep & Recovery", items: ["Melatonin", "L-Theanine", "Apigenin", "Glycine (PM)", "Magnesium L-Threonate"] },
            ].map(group => (
              <Card key={group.title}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <div key={item} className="flex items-center gap-2 text-xs py-1">
                        <Leaf className="w-3 h-3 text-green-500 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Longevity Protocol Resources</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <p className="text-muted-foreground">These resources are for educational purposes only:</p>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { name: "Peter Attia (Outlive)", url: "https://peterattiamd.com" },
                  { name: "David Sinclair Lab", url: "https://sinclair.hms.harvard.edu" },
                  { name: "Bryan Johnson (Blueprint)", url: "https://blueprint.bryanjohnson.com" },
                  { name: "Rhonda Patrick (FoundMyFitness)", url: "https://www.foundmyfitness.com" },
                  { name: "Andrew Huberman Lab", url: "https://hubermanlab.com" },
                  { name: "Examine.com (Evidence-based)", url: "https://examine.com" },
                ].map(r => (
                  <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <Eye className="w-3 h-3" /> {r.name}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
