import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  ClipboardList,
  DollarSign,
  FileText,
  Globe,
  Heart,
  Info,
  Languages,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User
} from "lucide-react";

interface USPSTFRecommendation {
  id: string;
  title: string;
  grade: string;
  category: string;
  ageRange: { min: number; max: number };
  gender: string;
  frequency: string;
  description: string;
  rationale: string;
  riskFactors?: string[];
}

interface Claim {
  id: string;
  claimNumber: string;
  dateOfService: string;
  provider: string;
  totalCharged: number;
  paidAmount: number;
  patientResponsibility: number;
  status: string;
  category: string;
  description: string;
}

interface ClaimsAnalysis {
  totalClaims: number;
  totalCharged: number;
  totalPaid: number;
  totalPatientResponsibility: number;
  approvalRate: number;
  denialRate: number;
  byCategory: Record<string, { count: number; charged: number; paid: number }>;
  byStatus: Record<string, number>;
  topDiagnoses: { code: string; description: string; count: number }[];
  topProcedures: { code: string; description: string; count: number; avgCost: number }[];
}

interface AIClaimsInsight {
  category: string;
  insight: string;
  recommendation: string;
  priority: string;
}

interface ClinicalSummary {
  id: string;
  title: string;
  content: string;
  category: string;
  dateCreated: string;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export default function PatientCareHub() {
  const [activeTab, setActiveTab] = useState("preventive");
  const { toast } = useToast();
  
  // Preventive care state
  const [patientAge, setPatientAge] = useState(45);
  const [patientGender, setPatientGender] = useState<"male" | "female">("male");
  const [useAI, setUseAI] = useState(true);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [smokingStatus, setSmokingStatus] = useState("never");
  
  // Translation state
  const [selectedSummary, setSelectedSummary] = useState<string>("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [translatedContent, setTranslatedContent] = useState<any>(null);
  const [customText, setCustomText] = useState("");
  const [customTranslation, setCustomTranslation] = useState<any>(null);

  // Queries
  const { data: guidelinesData } = useQuery<{ guidelines: USPSTFRecommendation[]; categories: string[] }>({
    queryKey: ["/api/patient-care/uspstf/guidelines"]
  });

  const { data: languagesData } = useQuery<{ languages: Language[] }>({
    queryKey: ["/api/patient-care/translations/languages"]
  });

  const { data: summariesData } = useQuery<{ summaries: ClinicalSummary[] }>({
    queryKey: ["/api/patient-care/translations/summaries/patient-001"]
  });

  const { data: claimsData } = useQuery<{ claims: Claim[] }>({
    queryKey: ["/api/patient-care/claims/patient-001"]
  });

  const { data: claimsAnalysis } = useQuery<{ analysis: ClaimsAnalysis }>({
    queryKey: ["/api/patient-care/claims/patient-001/analysis"]
  });

  const { data: aiInsightsData } = useQuery<{ insights: AIClaimsInsight[]; summary: string }>({
    queryKey: ["/api/patient-care/claims/patient-001/ai-insights"]
  });

  // Mutations
  const getRecommendationsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/patient-care/uspstf/recommendations", data);
      return response.json();
    }
  });

  const translateMutation = useMutation({
    mutationFn: async ({ summaryId, targetLanguage }: { summaryId: string; targetLanguage: string }) => {
      const response = await apiRequest("POST", `/api/patient-care/translations/translate/${summaryId}`, {
        targetLanguage,
        includePlainLanguage: true,
        readingLevel: "intermediate"
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTranslatedContent(data);
      toast({ title: "Translation complete", description: `Translated to ${data.targetLanguage}` });
    }
  });

  const translateTextMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/patient-care/translations/translate-text", data);
      return response.json();
    },
    onSuccess: (data) => {
      setCustomTranslation(data);
    }
  });

  const handleGetRecommendations = () => {
    getRecommendationsMutation.mutate({
      age: patientAge,
      gender: patientGender,
      riskFactors,
      smokingHistory: { status: smokingStatus },
      useAI
    });
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "B": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "C": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "denied": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "pending": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-patient-care-hub">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-patient-care">
            <Heart className="h-8 w-8 text-primary" />
            Patient Care Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Preventive care guidelines, claims analysis, and multilingual summaries
          </p>
        </div>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-300">
          <strong>Educational Information Only:</strong> This content is for health education and financial understanding. 
          It is NOT medical advice. Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="preventive" data-testid="tab-preventive">
            <Stethoscope className="h-4 w-4 mr-2" />
            Preventive Care
          </TabsTrigger>
          <TabsTrigger value="claims" data-testid="tab-claims">
            <DollarSign className="h-4 w-4 mr-2" />
            Claims Analysis
          </TabsTrigger>
          <TabsTrigger value="translations" data-testid="tab-translations">
            <Languages className="h-4 w-4 mr-2" />
            Translations
          </TabsTrigger>
        </TabsList>

        {/* Preventive Care Tab */}
        <TabsContent value="preventive" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Profile
                </CardTitle>
                <CardDescription>Enter profile to get personalized USPSTF recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input 
                    id="age" 
                    type="number" 
                    value={patientAge} 
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    min={0}
                    max={120}
                    data-testid="input-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={patientGender} onValueChange={(v) => setPatientGender(v as "male" | "female")}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Smoking Status</Label>
                  <Select value={smokingStatus} onValueChange={setSmokingStatus}>
                    <SelectTrigger data-testid="select-smoking">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never smoked</SelectItem>
                      <SelectItem value="former">Former smoker</SelectItem>
                      <SelectItem value="current">Current smoker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={useAI} onCheckedChange={setUseAI} />
                  <Label>Use AI-enhanced recommendations</Label>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleGetRecommendations}
                  disabled={getRecommendationsMutation.isPending}
                  data-testid="button-get-recommendations"
                >
                  {getRecommendationsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Get Recommendations
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  USPSTF Preventive Care Recommendations
                </CardTitle>
                <CardDescription>
                  Evidence-based preventive care guidelines (educational purposes only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getRecommendationsMutation.data ? (
                  <div className="space-y-4">
                    {getRecommendationsMutation.data.aiSummary && (
                      <Alert className="bg-muted/50">
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>{getRecommendationsMutation.data.aiSummary}</AlertDescription>
                      </Alert>
                    )}
                    
                    {getRecommendationsMutation.data.educationalNotes && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Educational Notes:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                          {getRecommendationsMutation.data.educationalNotes.map((note: string, i: number) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {(getRecommendationsMutation.data.applicable || getRecommendationsMutation.data.recommendations || []).map((rec: USPSTFRecommendation) => (
                          <div key={rec.id} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Badge className={getGradeColor(rec.grade)}>Grade {rec.grade}</Badge>
                                <span className="font-medium">{rec.title}</span>
                              </div>
                              <Badge variant="outline">{rec.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {rec.frequency}
                              </span>
                              <span>Ages {rec.ageRange.min}-{rec.ageRange.max}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Enter patient profile and click "Get Recommendations" to see applicable USPSTF guidelines</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All USPSTF Guidelines Reference</CardTitle>
              <CardDescription>Complete list of preventive care recommendations by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {guidelinesData?.categories?.map((cat) => (
                  <Badge key={cat} variant="outline">{cat}</Badge>
                ))}
              </div>
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guidelinesData?.guidelines?.slice(0, 10).map((g) => (
                    <div key={g.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getGradeColor(g.grade)} variant="secondary">
                          {g.grade}
                        </Badge>
                        <span className="font-medium text-sm">{g.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{g.frequency}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claims Analysis Tab */}
        <TabsContent value="claims" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{claimsAnalysis?.analysis?.totalClaims || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Charged</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${(claimsAnalysis?.analysis?.totalCharged || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Your Responsibility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">
                  ${(claimsAnalysis?.analysis?.totalPatientResponsibility || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {((claimsAnalysis?.analysis?.approvalRate || 0) * 100).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Financial Insights
                </CardTitle>
                <CardDescription>Administrative and cost analysis (not medical advice)</CardDescription>
              </CardHeader>
              <CardContent>
                {aiInsightsData?.summary && (
                  <p className="text-sm text-muted-foreground mb-4">{aiInsightsData.summary}</p>
                )}
                <div className="space-y-3">
                  {aiInsightsData?.insights?.map((insight, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <Badge variant="outline">{insight.category}</Badge>
                        <Badge className={
                          insight.priority === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                          insight.priority === "medium" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }>
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mb-1">{insight.insight}</p>
                      <p className="text-xs text-muted-foreground">{insight.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Claims
                </CardTitle>
                <CardDescription>Your healthcare claims history</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {claimsData?.claims?.slice(0, 10).map((claim) => (
                      <div key={claim.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <span className="font-medium text-sm">{claim.provider}</span>
                          <Badge className={getStatusColor(claim.status)}>{claim.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{claim.description}</p>
                        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                          <span>{claim.dateOfService}</span>
                          <div className="flex items-center gap-2">
                            <span>Charged: ${claim.totalCharged}</span>
                            <span className="text-amber-600">You owe: ${claim.patientResponsibility.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Diagnoses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {claimsAnalysis?.analysis?.topDiagnoses?.map((d) => (
                    <div key={d.code} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-mono text-sm text-primary">{d.code}</span>
                        <p className="text-xs text-muted-foreground">{d.description}</p>
                      </div>
                      <Badge variant="outline">{d.count} claims</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Procedures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {claimsAnalysis?.analysis?.topProcedures?.map((p) => (
                    <div key={p.code} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-mono text-sm text-primary">{p.code}</span>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{p.count}x</Badge>
                        <p className="text-xs text-muted-foreground">Avg: ${p.avgCost.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Translations Tab */}
        <TabsContent value="translations" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Clinical Summaries
                </CardTitle>
                <CardDescription>Select a summary to translate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Summary</Label>
                  <Select value={selectedSummary} onValueChange={setSelectedSummary}>
                    <SelectTrigger data-testid="select-summary">
                      <SelectValue placeholder="Choose a clinical summary..." />
                    </SelectTrigger>
                    <SelectContent>
                      {summariesData?.summaries?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Language</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger data-testid="select-language">
                      <SelectValue placeholder="Choose language..." />
                    </SelectTrigger>
                    <SelectContent>
                      {languagesData?.languages?.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name} ({l.nativeName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full"
                  onClick={() => translateMutation.mutate({ summaryId: selectedSummary, targetLanguage })}
                  disabled={!selectedSummary || !targetLanguage || translateMutation.isPending}
                  data-testid="button-translate"
                >
                  {translateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-2" />
                  )}
                  Translate Summary
                </Button>

                {selectedSummary && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Original (English):</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {summariesData?.summaries?.find(s => s.id === selectedSummary)?.content?.slice(0, 300)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Translation Result
                </CardTitle>
                <CardDescription>Translated clinical summary with plain language version</CardDescription>
              </CardHeader>
              <CardContent>
                {translatedContent ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">
                          {translatedContent.translatedTitle}
                        </h4>
                        <Badge>{translatedContent.targetLanguage}</Badge>
                      </div>
                      
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h5 className="text-sm font-medium mb-2">Translated Content:</h5>
                        <p className="text-sm whitespace-pre-wrap">{translatedContent.translatedContent}</p>
                      </div>

                      {translatedContent.plainLanguageVersion && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <h5 className="text-sm font-medium mb-2 text-blue-800 dark:text-blue-300">
                            Plain Language Version:
                          </h5>
                          <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-wrap">
                            {translatedContent.plainLanguageVersion}
                          </p>
                        </div>
                      )}

                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {translatedContent.noCdsCompliance}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a summary and language, then click translate</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Translate Custom Text
              </CardTitle>
              <CardDescription>Enter any health-related text to translate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Text to Translate</Label>
                    <Textarea 
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Enter health-related text to translate..."
                      className="min-h-[150px]"
                      data-testid="input-custom-text"
                    />
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Target language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {languagesData?.languages?.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => translateTextMutation.mutate({
                        text: customText,
                        sourceLanguage: "English",
                        targetLanguage,
                        context: "Clinical health record content"
                      })}
                      disabled={!customText || !targetLanguage || translateTextMutation.isPending}
                      data-testid="button-translate-custom"
                    >
                      {translateTextMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Translate
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {customTranslation ? (
                    <>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h5 className="text-sm font-medium mb-2">Translation:</h5>
                        <p className="text-sm whitespace-pre-wrap">{customTranslation.translatedText}</p>
                      </div>
                      {customTranslation.plainLanguageVersion && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <h5 className="text-sm font-medium mb-2">Plain Language:</h5>
                          <p className="text-sm whitespace-pre-wrap">{customTranslation.plainLanguageVersion}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>Translation will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Languages</CardTitle>
              <CardDescription>30 languages available for translation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {languagesData?.languages?.map((l) => (
                  <Badge key={l.code} variant="outline" className="cursor-pointer hover-elevate" onClick={() => setTargetLanguage(l.code)}>
                    {l.name} - {l.nativeName}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
