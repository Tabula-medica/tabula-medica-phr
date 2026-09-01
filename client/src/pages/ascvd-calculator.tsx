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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock,
  Heart,
  HeartPulse,
  Info,
  Loader2,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

const DISCLAIMER = "This ASCVD risk score is for educational and tracking purposes only. It does not constitute medical advice. The Pooled Cohort Equations have known limitations and may over- or under-estimate risk in some populations. Always discuss your cardiovascular risk with your healthcare provider.";
const PROFILE_ID = "profile-default";

type Sex = "male" | "female";
type Race = "white" | "african_american" | "other";
type RiskCategory = "low" | "borderline" | "intermediate" | "high";

interface ASCVDInputs {
  age: number;
  sex: Sex;
  race: Race;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBP: number;
  onBPMeds: boolean;
  diabetic: boolean;
  smoker: boolean;
  ldlCholesterol?: number;
  a1c?: number;
  bmi?: number;
  familyHistory?: boolean;
}

interface ASCVDResult {
  id: string;
  tenYearRisk: number;
  lifetimeRisk?: number;
  riskCategory: RiskCategory;
  optimalRisk: number;
  inputs: ASCVDInputs;
  riskEnhancers: string[];
  statinRecommendation: string;
  guidelineNotes: string[];
  calculatedAt: string;
  disclaimer: string;
  aiGenerated: boolean;
  aiDataSources?: string[];
}

interface PreventiveGuideline {
  id: string;
  category: string;
  title: string;
  source: string;
  year: number;
  grade: string;
  population: string;
  recommendation: string;
  frequencyText: string;
  riskLevel?: string;
  keyPoints: string[];
  references: string[];
}

const RISK_COLORS: Record<RiskCategory, { bg: string; text: string; border: string }> = {
  low: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-700" },
  borderline: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-300 dark:border-yellow-700" },
  intermediate: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-300 dark:border-orange-700" },
  high: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
};

const CATEGORY_ICONS: Record<string, string> = {
  Cardiovascular: "heart",
  Metabolic: "activity",
  Behavioral: "zap",
  Lifestyle: "activity",
  Renal: "shield",
};

export default function ASCVDCalculatorPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("calculator");
  const [formInputs, setFormInputs] = useState<ASCVDInputs>({
    age: 55,
    sex: "male",
    race: "white",
    totalCholesterol: 200,
    hdlCholesterol: 50,
    systolicBP: 130,
    onBPMeds: false,
    diabetic: false,
    smoker: false,
    ldlCholesterol: undefined,
    a1c: undefined,
    bmi: undefined,
    familyHistory: false,
  });

  const [result, setResult] = useState<ASCVDResult | null>(null);

  const guidelinesQuery = useQuery<PreventiveGuideline[]>({
    queryKey: ["/api/ascvd/guidelines"],
    queryFn: () => fetch("/api/ascvd/guidelines").then(r => r.json()),
  });

  const historyQuery = useQuery<ASCVDResult[]>({
    queryKey: ["/api/ascvd/history", PROFILE_ID],
    queryFn: () => fetch(`/api/ascvd/history/${PROFILE_ID}`).then(r => r.json()),
  });

  const calculateMutation = useMutation({
    mutationFn: (inputs: ASCVDInputs) => apiRequest("POST", `/api/ascvd/calculate/${PROFILE_ID}`, inputs),
    onSuccess: async (response) => {
      const data = await response.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ascvd/history"] });
      toast({ title: "ASCVD risk calculated" });
    },
    onError: (err: any) => {
      toast({ title: "Calculation failed", description: err.message, variant: "destructive" });
    },
  });

  const autoCalculateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/ascvd/auto-calculate/${PROFILE_ID}`),
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.error) {
        toast({ title: "Auto-calculation incomplete", description: data.error, variant: "destructive" });
        if (data.fallbackInputs) {
          setFormInputs(prev => ({ ...prev, ...data.fallbackInputs }));
        }
      } else {
        setResult(data);
        setFormInputs(data.inputs);
        queryClient.invalidateQueries({ queryKey: ["/api/ascvd/history"] });
        toast({ title: "ASCVD risk auto-calculated from your health data" });
      }
    },
    onError: (err: any) => {
      toast({ title: "AI auto-calculation failed", description: err.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof ASCVDInputs>(key: K, value: ASCVDInputs[K]) => {
    setFormInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6" data-testid="ascvd-calculator-page">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="disclaimer-alert">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-300">Educational Information Only</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">{DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <HeartPulse className="h-7 w-7 text-red-500" />
            ASCVD Risk Calculator
          </h1>
          <p className="text-muted-foreground text-sm">10-Year Atherosclerotic Cardiovascular Disease Risk Assessment &amp; Preventive Guidelines</p>
        </div>
        <Button
          onClick={() => autoCalculateMutation.mutate()}
          disabled={autoCalculateMutation.isPending}
          className="gap-2"
          data-testid="button-auto-calculate"
        >
          {autoCalculateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {autoCalculateMutation.isPending ? "Analyzing health data..." : "AI Auto-Calculate"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
          <TabsTrigger value="calculator" data-testid="tab-calculator">Calculator</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="guidelines" data-testid="tab-guidelines">Guidelines</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-4" data-testid="calculator-tab-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-inputs">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Risk Factor Inputs
                </CardTitle>
                <CardDescription>Enter your values to calculate your 10-year ASCVD risk using the Pooled Cohort Equations (2013 ACC/AHA).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ascvd-calculator-age-40-79">Age (40-79) *</Label>
                    <Input id="ascvd-calculator-age-40-79" type="number" min={20} max={99} value={formInputs.age} onChange={e => updateField("age", parseInt(e.target.value) || 0)} data-testid="input-age" />
                  </div>
                  <div>
                    <Label htmlFor="ascvd-calculator-biological-sex">Biological Sex *</Label>
                    <Select value={formInputs.sex} onValueChange={v => updateField("sex", v as Sex)}>
                      <SelectTrigger id="ascvd-calculator-biological-sex" data-testid="select-sex"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="ascvd-calculator-race-ethnicity">Race/Ethnicity *</Label>
                  <Select value={formInputs.race} onValueChange={v => updateField("race", v as Race)}>
                    <SelectTrigger id="ascvd-calculator-race-ethnicity" data-testid="select-race"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White / Other</SelectItem>
                      <SelectItem value="african_american">African American</SelectItem>
                      <SelectItem value="other">Other (South Asian, Hispanic, etc.)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">The PCE were developed from White and African American cohorts. Accuracy may vary for other groups.</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ascvd-calculator-total-cholesterol-mg-dl">Total Cholesterol (mg/dL) *</Label>
                    <Input id="ascvd-calculator-total-cholesterol-mg-dl" type="number" min={100} max={400} value={formInputs.totalCholesterol} onChange={e => updateField("totalCholesterol", parseInt(e.target.value) || 0)} data-testid="input-total-cholesterol" />
                  </div>
                  <div>
                    <Label htmlFor="ascvd-calculator-hdl-cholesterol-mg-dl">HDL Cholesterol (mg/dL) *</Label>
                    <Input id="ascvd-calculator-hdl-cholesterol-mg-dl" type="number" min={20} max={150} value={formInputs.hdlCholesterol} onChange={e => updateField("hdlCholesterol", parseInt(e.target.value) || 0)} data-testid="input-hdl" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ascvd-calculator-ldl-cholesterol-mg-dl">LDL Cholesterol (mg/dL)</Label>
                  <Input id="ascvd-calculator-ldl-cholesterol-mg-dl" type="number" min={30} max={300} value={formInputs.ldlCholesterol || ""} onChange={e => updateField("ldlCholesterol", e.target.value ? parseInt(e.target.value) : undefined)} placeholder="Optional — used for statin guidance" data-testid="input-ldl" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ascvd-calculator-systolic-blood-pressure-mmhg">Systolic Blood Pressure (mmHg) *</Label>
                    <Input id="ascvd-calculator-systolic-blood-pressure-mmhg" type="number" min={80} max={250} value={formInputs.systolicBP} onChange={e => updateField("systolicBP", parseInt(e.target.value) || 0)} data-testid="input-sbp" />
                  </div>
                  <div className="flex items-end pb-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={formInputs.onBPMeds} onCheckedChange={v => updateField("onBPMeds", v)} data-testid="switch-bp-meds" />
                      <FieldCaption className="text-sm">On BP Medication</FieldCaption>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={formInputs.diabetic} onCheckedChange={v => updateField("diabetic", v)} data-testid="switch-diabetic" />
                    <FieldCaption>Diabetes</FieldCaption>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formInputs.smoker} onCheckedChange={v => updateField("smoker", v)} data-testid="switch-smoker" />
                    <FieldCaption>Current Smoker</FieldCaption>
                  </div>
                </div>

                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Enhancers (Optional)</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ascvd-calculator-a1c">A1C (%)</Label>
                    <Input id="ascvd-calculator-a1c" type="number" step="0.1" min={3} max={15} value={formInputs.a1c || ""} onChange={e => updateField("a1c", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g., 5.7" data-testid="input-a1c" />
                  </div>
                  <div>
                    <Label htmlFor="ascvd-calculator-bmi">BMI</Label>
                    <Input id="ascvd-calculator-bmi" type="number" step="0.1" min={15} max={60} value={formInputs.bmi || ""} onChange={e => updateField("bmi", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="e.g., 28.5" data-testid="input-bmi" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={formInputs.familyHistory || false} onCheckedChange={v => updateField("familyHistory", v)} data-testid="switch-family-history" />
                  <FieldCaption>Family history of premature ASCVD</FieldCaption>
                </div>

                <Button
                  onClick={() => calculateMutation.mutate(formInputs)}
                  disabled={calculateMutation.isPending}
                  className="w-full mt-4"
                  size="lg"
                  data-testid="button-calculate"
                >
                  {calculateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculating...</>
                  ) : (
                    <><Calculator className="h-4 w-4 mr-2" /> Calculate 10-Year ASCVD Risk</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {result ? <ResultDisplay result={result} /> : (
                <Card className="h-full flex items-center justify-center" data-testid="card-no-result">
                  <CardContent className="text-center py-16 space-y-4">
                    <Heart className="h-16 w-16 mx-auto text-muted-foreground/30" />
                    <h3 className="text-lg font-semibold text-muted-foreground">No Calculation Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Enter your risk factors and click Calculate, or use AI Auto-Calculate to pull values from your health records.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4" data-testid="results-tab-content">
          {result ? <ResultDisplay result={result} expanded /> : (
            <Card className="text-center py-12" data-testid="card-no-results-yet">
              <CardContent>
                <Calculator className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Calculate your ASCVD risk first to see detailed results here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-6" data-testid="guidelines-tab-content">
          <GuidelinesPanel guidelines={guidelinesQuery.data || []} isLoading={guidelinesQuery.isLoading} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4" data-testid="history-tab-content">
          <HistoryPanel history={historyQuery.data || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultDisplay({ result, expanded = false }: { result: ASCVDResult; expanded?: boolean }) {
  const riskPercent = (result.tenYearRisk * 100).toFixed(1);
  const optimalPercent = (result.optimalRisk * 100).toFixed(1);
  const colors = RISK_COLORS[result.riskCategory];
  const riskLabel = result.riskCategory.charAt(0).toUpperCase() + result.riskCategory.slice(1);

  return (
    <div className="space-y-4">
      <Card className={`${colors.border} border-2`} data-testid="card-risk-result">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">10-Year ASCVD Risk</CardTitle>
            {result.aiGenerated && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-ai-generated">
                <Sparkles className="h-3 w-3" /> AI Calculated
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-4">
            <span className={`text-5xl font-bold ${colors.text}`} data-testid="text-risk-percent">{riskPercent}%</span>
            <Badge className={`${colors.bg} ${colors.text} mb-1`} variant="secondary" data-testid="badge-risk-category">{riskLabel} Risk</Badge>
          </div>
          <Progress
            value={Math.min(result.tenYearRisk * 100, 100)}
            className="h-3 mb-3"
            data-testid="progress-risk"
          />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span>Optimal: {optimalPercent}%</span>
            </div>
            {result.lifetimeRisk !== undefined && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span>Lifetime: {(result.lifetimeRisk * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-statin-guidance">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            2018 ACC/AHA Guideline Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm" data-testid="text-statin-recommendation">{result.statinRecommendation}</p>
        </CardContent>
      </Card>

      {result.riskEnhancers.length > 0 && (
        <Card data-testid="card-risk-enhancers">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk-Enhancing Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {result.riskEnhancers.map((e, i) => (
                <li key={i} className="text-sm flex items-start gap-2" data-testid={`risk-enhancer-${i}`}>
                  <span className="text-amber-500 mt-1">•</span>
                  {e}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {expanded && (
        <>
          <Card data-testid="card-guideline-notes">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                Guideline Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.guidelineNotes.map((note, i) => (
                  <li key={i} className="text-sm text-muted-foreground" data-testid={`guideline-note-${i}`}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.aiGenerated && result.aiDataSources && result.aiDataSources.length > 0 && (
            <Card data-testid="card-ai-sources">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Data Sources
                </CardTitle>
                <CardDescription>The following data was used by AI to populate the calculator</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.aiDataSources.map((src, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                      {src}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card data-testid="card-input-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Input Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Age:</span> <strong>{result.inputs.age}</strong></div>
                <div><span className="text-muted-foreground">Sex:</span> <strong className="capitalize">{result.inputs.sex}</strong></div>
                <div><span className="text-muted-foreground">Race:</span> <strong className="capitalize">{result.inputs.race.replace("_", " ")}</strong></div>
                <div><span className="text-muted-foreground">Total Chol:</span> <strong>{result.inputs.totalCholesterol} mg/dL</strong></div>
                <div><span className="text-muted-foreground">HDL:</span> <strong>{result.inputs.hdlCholesterol} mg/dL</strong></div>
                <div><span className="text-muted-foreground">Systolic BP:</span> <strong>{result.inputs.systolicBP} mmHg</strong></div>
                <div><span className="text-muted-foreground">BP Meds:</span> <strong>{result.inputs.onBPMeds ? "Yes" : "No"}</strong></div>
                <div><span className="text-muted-foreground">Diabetes:</span> <strong>{result.inputs.diabetic ? "Yes" : "No"}</strong></div>
                <div><span className="text-muted-foreground">Smoker:</span> <strong>{result.inputs.smoker ? "Yes" : "No"}</strong></div>
                {result.inputs.ldlCholesterol && <div><span className="text-muted-foreground">LDL:</span> <strong>{result.inputs.ldlCholesterol} mg/dL</strong></div>}
                {result.inputs.a1c && <div><span className="text-muted-foreground">A1C:</span> <strong>{result.inputs.a1c}%</strong></div>}
                {result.inputs.bmi && <div><span className="text-muted-foreground">BMI:</span> <strong>{result.inputs.bmi}</strong></div>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" data-testid="result-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">{result.disclaimer}</AlertDescription>
      </Alert>
    </div>
  );
}

function GuidelinesPanel({ guidelines, isLoading }: { guidelines: PreventiveGuideline[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const categories = [...new Set(guidelines.map(g => g.category))];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          Latest Preventive Guidelines (2022-2024)
        </h3>
        <p className="text-sm text-muted-foreground">Evidence-based recommendations from ACC/AHA, USPSTF, ADA, and KDIGO</p>
      </div>

      <Alert className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/10" data-testid="guidelines-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          These guidelines are provided for educational purposes. Clinical decisions should be made in consultation with your healthcare provider based on your individual circumstances.
        </AlertDescription>
      </Alert>

      {categories.map(cat => (
        <div key={cat} className="space-y-3">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            {cat === "Cardiovascular" && <Heart className="h-4 w-4 text-red-500" />}
            {cat === "Metabolic" && <Activity className="h-4 w-4 text-orange-500" />}
            {cat === "Behavioral" && <Zap className="h-4 w-4 text-yellow-500" />}
            {cat === "Lifestyle" && <Activity className="h-4 w-4 text-green-500" />}
            {cat === "Renal" && <Shield className="h-4 w-4 text-blue-500" />}
            {cat}
          </h4>

          <div className="space-y-3">
            {guidelines.filter(g => g.category === cat).map((g) => (
              <Card key={g.id} data-testid={`guideline-${g.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">{g.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {g.source} • Grade: {g.grade}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{g.year}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Population</p>
                    <p className="text-sm">{g.population}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recommendation</p>
                    <p className="text-sm">{g.recommendation}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{g.frequencyText}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Key Points</p>
                    <ul className="space-y-1">
                      {g.keyPoints.map((p, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {g.references.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground italic">
                        {g.references.join(" ")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryPanel({ history }: { history: ASCVDResult[] }) {
  if (history.length === 0) {
    return (
      <Card className="text-center py-12" data-testid="card-no-history">
        <CardContent>
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No calculation history yet. Calculate your ASCVD risk to start tracking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Calculation History</h3>
      <div className="space-y-3">
        {history.map((r) => {
          const colors = RISK_COLORS[r.riskCategory];
          const riskPercent = (r.tenYearRisk * 100).toFixed(1);
          return (
            <Card key={r.id} data-testid={`history-${r.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors.bg}`}>
                      <span className={`text-lg font-bold ${colors.text}`}>{riskPercent}%</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${colors.bg} ${colors.text} text-xs`} variant="secondary">
                          {r.riskCategory.charAt(0).toUpperCase() + r.riskCategory.slice(1)} Risk
                        </Badge>
                        {r.aiGenerated && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Sparkles className="h-3 w-3" /> AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.calculatedAt).toLocaleString()} • Age {r.inputs.age} • {r.inputs.sex}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p>TC: {r.inputs.totalCholesterol} / HDL: {r.inputs.hdlCholesterol}</p>
                    <p className="text-muted-foreground text-xs">SBP: {r.inputs.systolicBP} mmHg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
