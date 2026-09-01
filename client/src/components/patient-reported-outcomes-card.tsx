import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Heart,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Moon,
  Zap,
  ThermometerSun,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

interface OutcomeReport {
  id: string;
  profileId: string;
  reportType: string;
  qualityOfLifeRating: number | null;
  symptomSeverityRating: number | null;
  satisfactionRating: number | null;
  overallWellbeingRating: number | null;
  painLevel: number | null;
  energyLevel: number | null;
  moodRating: number | null;
  sleepQualityRating: number | null;
  dailyFunctioningRating: number | null;
  treatmentEffectivenessRating: number | null;
  sideEffectsReported: string | null;
  concernsNotes: string | null;
  additionalComments: string | null;
  wouldRecommend: boolean | null;
  providerReviewed: boolean;
  createdAt: string;
}

interface SymptomLog {
  id: string;
  symptomName: string;
  severity: number;
  frequency: string | null;
  notes: string | null;
  loggedAt: string;
}

interface OutcomeSummary {
  periodDays: number;
  totalReports: number;
  totalSymptomLogs: number;
  averages: {
    qualityOfLife: number | null;
    symptomSeverity: number | null;
    satisfaction: number | null;
    painLevel: number | null;
  };
  topSymptoms: Array<{ name: string; count: number }>;
  trends: {
    qolTrend: "improving" | "stable" | "declining" | null;
    symptomTrend: "improving" | "stable" | "declining" | null;
    satisfactionTrend: "improving" | "stable" | "declining" | null;
  };
}

function TrendIcon({ trend, inverted = false }: { trend: string | null; inverted?: boolean }) {
  if (!trend) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  if (trend === "improving") {
    return <TrendingUp className={`h-4 w-4 ${inverted ? "text-red-500" : "text-green-500"}`} />;
  }
  if (trend === "declining") {
    return <TrendingDown className={`h-4 w-4 ${inverted ? "text-green-500" : "text-red-500"}`} />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function RatingSlider({ 
  label, 
  value, 
  onChange, 
  min = 1, 
  max = 10,
  lowLabel = "Poor",
  highLabel = "Excellent",
  icon: Icon,
}: { 
  label: string; 
  value: number; 
  onChange: (value: number) => void; 
  min?: number; 
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  icon?: any;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <FieldCaption className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {label}
        </FieldCaption>
        <Badge variant="outline">{value}/{max}</Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

function getMoodIcon(rating: number) {
  if (rating >= 8) return <Smile className="h-5 w-5 text-green-500" />;
  if (rating >= 5) return <Meh className="h-5 w-5 text-yellow-500" />;
  return <Frown className="h-5 w-5 text-red-500" />;
}

function getSeverityColor(severity: number) {
  if (severity >= 8) return "text-red-500";
  if (severity >= 5) return "text-yellow-500";
  return "text-green-500";
}

export function PatientReportedOutcomesCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("report");
  
  const [reportType, setReportType] = useState("quality_of_life");
  const [qualityOfLife, setQualityOfLife] = useState(5);
  const [symptomSeverity, setSymptomSeverity] = useState(3);
  const [satisfaction, setSatisfaction] = useState(5);
  const [painLevel, setPainLevel] = useState(2);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [moodRating, setMoodRating] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [dailyFunctioning, setDailyFunctioning] = useState(5);
  const [sideEffects, setSideEffects] = useState("");
  const [concerns, setConcerns] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  
  const [symptomName, setSymptomName] = useState("");
  const [symptomSeverityLog, setSymptomSeverityLog] = useState(5);
  const [symptomFrequency, setSymptomFrequency] = useState("");
  const [symptomNotes, setSymptomNotes] = useState("");

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<{ success: boolean; summary: OutcomeSummary }>({
    queryKey: ["/api/patient-outcomes/summary"],
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery<{ success: boolean; reports: OutcomeReport[] }>({
    queryKey: ["/api/patient-outcomes/reports"],
  });

  const { data: symptomsData, isLoading: symptomsLoading } = useQuery<{ success: boolean; symptoms: SymptomLog[] }>({
    queryKey: ["/api/patient-outcomes/symptoms"],
  });

  const submitReportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/patient-outcomes/reports", data);
    },
    onSuccess: () => {
      toast({ title: "Report Submitted", description: "Your outcome report has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outcomes/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outcomes/summary"] });
      resetReportForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report. Please try again.", variant: "destructive" });
    },
  });

  const logSymptomMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/patient-outcomes/symptoms", data);
    },
    onSuccess: () => {
      toast({ title: "Symptom Logged", description: "Your symptom has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outcomes/symptoms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-outcomes/summary"] });
      resetSymptomForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log symptom. Please try again.", variant: "destructive" });
    },
  });

  function resetReportForm() {
    setQualityOfLife(5);
    setSymptomSeverity(3);
    setSatisfaction(5);
    setPainLevel(2);
    setEnergyLevel(5);
    setMoodRating(5);
    setSleepQuality(5);
    setDailyFunctioning(5);
    setSideEffects("");
    setConcerns("");
    setAdditionalComments("");
    setWouldRecommend(null);
  }

  function resetSymptomForm() {
    setSymptomName("");
    setSymptomSeverityLog(5);
    setSymptomFrequency("");
    setSymptomNotes("");
  }

  function handleSubmitReport() {
    submitReportMutation.mutate({
      reportType,
      qualityOfLifeRating: qualityOfLife,
      symptomSeverityRating: symptomSeverity,
      satisfactionRating: satisfaction,
      painLevel,
      energyLevel,
      moodRating,
      sleepQualityRating: sleepQuality,
      dailyFunctioningRating: dailyFunctioning,
      sideEffectsReported: sideEffects || null,
      concernsNotes: concerns || null,
      additionalComments: additionalComments || null,
      wouldRecommend,
    });
  }

  function handleLogSymptom() {
    if (!symptomName.trim()) {
      toast({ title: "Error", description: "Please enter a symptom name.", variant: "destructive" });
      return;
    }
    logSymptomMutation.mutate({
      symptomName: symptomName.trim(),
      severity: symptomSeverityLog,
      frequency: symptomFrequency || null,
      notes: symptomNotes || null,
    });
  }

  const summary = summaryData?.summary;

  return (
    <Card className="w-full" data-testid="patient-reported-outcomes-card">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Patient-Reported Outcomes
            </CardTitle>
            <CardDescription>
              Track your health experience, quality of life, and treatment outcomes
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchSummary()}
            data-testid="button-refresh-outcomes"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="report" data-testid="tab-report">
              <Plus className="h-4 w-4 mr-2" />
              Report
            </TabsTrigger>
            <TabsTrigger value="symptoms" data-testid="tab-symptoms">
              <ThermometerSun className="h-4 w-4 mr-2" />
              Symptoms
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Activity className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">
              <Heart className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="report" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="patient-reported-outcome-report-type">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="patient-reported-outcome-report-type" data-testid="select-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality_of_life">Quality of Life Assessment</SelectItem>
                    <SelectItem value="treatment_outcome">Treatment Outcome</SelectItem>
                    <SelectItem value="satisfaction_survey">Satisfaction Survey</SelectItem>
                    <SelectItem value="symptom_assessment">Symptom Assessment</SelectItem>
                    <SelectItem value="general_experience">General Experience</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <RatingSlider
                  label="Quality of Life"
                  value={qualityOfLife}
                  onChange={setQualityOfLife}
                  icon={Heart}
                />
                <RatingSlider
                  label="Symptom Severity"
                  value={symptomSeverity}
                  onChange={setSymptomSeverity}
                  lowLabel="None"
                  highLabel="Severe"
                  icon={AlertTriangle}
                />
                <RatingSlider
                  label="Overall Satisfaction"
                  value={satisfaction}
                  onChange={setSatisfaction}
                  lowLabel="Very Dissatisfied"
                  highLabel="Very Satisfied"
                  icon={Smile}
                />
                <RatingSlider
                  label="Pain Level"
                  value={painLevel}
                  onChange={setPainLevel}
                  min={0}
                  lowLabel="No Pain"
                  highLabel="Severe Pain"
                  icon={Stethoscope}
                />
                <RatingSlider
                  label="Energy Level"
                  value={energyLevel}
                  onChange={setEnergyLevel}
                  lowLabel="Very Low"
                  highLabel="Very High"
                  icon={Zap}
                />
                <RatingSlider
                  label="Mood"
                  value={moodRating}
                  onChange={setMoodRating}
                  lowLabel="Very Low"
                  highLabel="Very High"
                  icon={Smile}
                />
                <RatingSlider
                  label="Sleep Quality"
                  value={sleepQuality}
                  onChange={setSleepQuality}
                  lowLabel="Very Poor"
                  highLabel="Excellent"
                  icon={Moon}
                />
                <RatingSlider
                  label="Daily Functioning"
                  value={dailyFunctioning}
                  onChange={setDailyFunctioning}
                  lowLabel="Very Difficult"
                  highLabel="No Difficulty"
                  icon={Activity}
                />
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="patient-reported-outcome-side-effects-if-any">Side Effects (if any)</Label>
                  <Textarea id="patient-reported-outcome-side-effects-if-any"
                    placeholder="Describe any side effects you've experienced..."
                    value={sideEffects}
                    onChange={(e) => setSideEffects(e.target.value)}
                    data-testid="input-side-effects"
                  />
                </div>
                
                <div>
                  <Label htmlFor="patient-reported-outcome-concerns-or-issues">Concerns or Issues</Label>
                  <Textarea id="patient-reported-outcome-concerns-or-issues"
                    placeholder="Share any concerns about your care or treatment..."
                    value={concerns}
                    onChange={(e) => setConcerns(e.target.value)}
                    data-testid="input-concerns"
                  />
                </div>
                
                <div>
                  <Label htmlFor="patient-reported-outcome-additional-comments">Additional Comments</Label>
                  <Textarea id="patient-reported-outcome-additional-comments"
                    placeholder="Any other feedback you'd like to share..."
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    data-testid="input-comments"
                  />
                </div>
                
                <div>
                  <FieldCaption>Would you recommend this care/treatment to others?</FieldCaption>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant={wouldRecommend === true ? "default" : "outline"}
                      onClick={() => setWouldRecommend(true)}
                      data-testid="button-recommend-yes"
                    >
                      Yes
                    </Button>
                    <Button 
                      variant={wouldRecommend === false ? "default" : "outline"}
                      onClick={() => setWouldRecommend(false)}
                      data-testid="button-recommend-no"
                    >
                      No
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleSubmitReport} 
                disabled={submitReportMutation.isPending}
                className="w-full"
                data-testid="button-submit-report"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitReportMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="symptoms" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Log a Symptom</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="patient-reported-outcome-symptom-name">Symptom Name</Label>
                  <Input id="patient-reported-outcome-symptom-name"
                    placeholder="e.g., Headache, Fatigue, Nausea..."
                    value={symptomName}
                    onChange={(e) => setSymptomName(e.target.value)}
                    data-testid="input-symptom-name"
                  />
                </div>
                
                <RatingSlider
                  label="Severity"
                  value={symptomSeverityLog}
                  onChange={setSymptomSeverityLog}
                  lowLabel="Mild"
                  highLabel="Severe"
                />
                
                <div>
                  <Label htmlFor="patient-reported-outcome-frequency">Frequency</Label>
                  <Select value={symptomFrequency} onValueChange={setSymptomFrequency}>
                    <SelectTrigger id="patient-reported-outcome-frequency" data-testid="select-symptom-frequency">
                      <SelectValue placeholder="How often does this occur?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="constant">Constant</SelectItem>
                      <SelectItem value="multiple_daily">Multiple times daily</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="several_weekly">Several times a week</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="occasional">Occasional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="patient-reported-outcome-notes">Notes</Label>
                  <Textarea id="patient-reported-outcome-notes"
                    placeholder="Any additional details about this symptom..."
                    value={symptomNotes}
                    onChange={(e) => setSymptomNotes(e.target.value)}
                    data-testid="input-symptom-notes"
                  />
                </div>
                
                <Button 
                  onClick={handleLogSymptom}
                  disabled={logSymptomMutation.isPending || !symptomName.trim()}
                  className="w-full"
                  data-testid="button-log-symptom"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {logSymptomMutation.isPending ? "Logging..." : "Log Symptom"}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Symptoms</CardTitle>
              </CardHeader>
              <CardContent>
                {symptomsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : symptomsData?.symptoms?.length ? (
                  <div className="space-y-2">
                    {symptomsData.symptoms.slice(0, 10).map((symptom, i) => (
                      <div 
                        key={symptom.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`symptom-log-${i}`}
                      >
                        <div>
                          <p className="font-medium">{symptom.symptomName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(symptom.loggedAt).toLocaleDateString()}
                            {symptom.frequency && ` - ${symptom.frequency}`}
                          </p>
                        </div>
                        <Badge className={getSeverityColor(symptom.severity)}>
                          Severity: {symptom.severity}/10
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No symptoms logged yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4 mt-4">
            {reportsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : reportsData?.reports?.length ? (
              <div className="space-y-3">
                {reportsData.reports.map((report, i) => (
                  <Card key={report.id} data-testid={`report-history-${i}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {report.reportType.replace(/_/g, " ")}
                            </Badge>
                            {report.providerReviewed && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Reviewed
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(report.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {report.moodRating && getMoodIcon(report.moodRating)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        {report.qualityOfLifeRating && (
                          <div className="text-center p-2 bg-muted/50 rounded">
                            <p className="text-xs text-muted-foreground">Quality of Life</p>
                            <p className="font-bold">{report.qualityOfLifeRating}/10</p>
                          </div>
                        )}
                        {report.symptomSeverityRating && (
                          <div className="text-center p-2 bg-muted/50 rounded">
                            <p className="text-xs text-muted-foreground">Symptom Severity</p>
                            <p className={`font-bold ${getSeverityColor(report.symptomSeverityRating)}`}>
                              {report.symptomSeverityRating}/10
                            </p>
                          </div>
                        )}
                        {report.satisfactionRating && (
                          <div className="text-center p-2 bg-muted/50 rounded">
                            <p className="text-xs text-muted-foreground">Satisfaction</p>
                            <p className="font-bold">{report.satisfactionRating}/10</p>
                          </div>
                        )}
                        {report.painLevel !== null && (
                          <div className="text-center p-2 bg-muted/50 rounded">
                            <p className="text-xs text-muted-foreground">Pain Level</p>
                            <p className={`font-bold ${getSeverityColor(report.painLevel)}`}>
                              {report.painLevel}/10
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {(report.concernsNotes || report.sideEffectsReported) && (
                        <div className="mt-3 text-sm">
                          {report.sideEffectsReported && (
                            <p><span className="font-medium">Side Effects:</span> {report.sideEffectsReported}</p>
                          )}
                          {report.concernsNotes && (
                            <p><span className="font-medium">Concerns:</span> {report.concernsNotes}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No reports yet</p>
                <p className="text-sm text-muted-foreground">
                  Submit your first outcome report to start tracking
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="summary" className="space-y-4 mt-4">
            {summaryLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-32" />
              </div>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card data-testid="card-total-reports">
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground">Reports ({summary.periodDays}d)</p>
                      <p className="text-2xl font-bold">{summary.totalReports}</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-symptom-logs">
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground">Symptoms Logged</p>
                      <p className="text-2xl font-bold">{summary.totalSymptomLogs}</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-avg-qol">
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground">Avg Quality of Life</p>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-2xl font-bold">
                          {summary.averages.qualityOfLife ?? "-"}
                        </p>
                        <TrendIcon trend={summary.trends.qolTrend} />
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-avg-satisfaction">
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground">Avg Satisfaction</p>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-2xl font-bold">
                          {summary.averages.satisfaction ?? "-"}
                        </p>
                        <TrendIcon trend={summary.trends.satisfactionTrend} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card data-testid="card-health-metrics">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Health Metrics Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Quality of Life</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{summary.averages.qualityOfLife ?? "-"}/10</Badge>
                            <TrendIcon trend={summary.trends.qolTrend} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Symptom Severity</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getSeverityColor(summary.averages.symptomSeverity ?? 0)}>
                              {summary.averages.symptomSeverity ?? "-"}/10
                            </Badge>
                            <TrendIcon trend={summary.trends.symptomTrend} inverted />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Pain Level</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getSeverityColor(summary.averages.painLevel ?? 0)}>
                              {summary.averages.painLevel ?? "-"}/10
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Satisfaction</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{summary.averages.satisfaction ?? "-"}/10</Badge>
                            <TrendIcon trend={summary.trends.satisfactionTrend} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card data-testid="card-top-symptoms">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Most Reported Symptoms</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {summary.topSymptoms.length > 0 ? (
                        <div className="space-y-2">
                          {summary.topSymptoms.map((symptom, i) => (
                            <div 
                              key={symptom.name} 
                              className="flex items-center justify-between p-2 bg-muted/50 rounded"
                            >
                              <span className="text-sm">{symptom.name}</span>
                              <Badge variant="outline">{symptom.count}x</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No symptoms logged in this period
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                <Alert>
                  <Heart className="h-4 w-4" />
                  <AlertDescription>
                    Your healthcare provider can review these reports to better understand your experience 
                    and adjust your care plan accordingly.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No summary data available</p>
                <p className="text-sm text-muted-foreground">
                  Submit outcome reports to see your health summary
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PatientReportedOutcomesCard;
