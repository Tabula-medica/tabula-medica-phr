import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pill,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Send,
  Search,
  Shield,
  Users,
  Activity,
  FileText,
  Zap,
  Package
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface MedicationSuggestion {
  id: string;
  medicationName: string;
  genericName: string;
  drugClass: string;
  suggestedDosage: string;
  frequency: string;
  rationale: string;
  considerations: string[];
  interactionWarnings: {
    drug1: string;
    drug2: string;
    severity: string;
    description: string;
    managementRecommendation: string;
  }[];
  allergyWarnings: string[];
  contraindications: string[];
  alternatives: { name: string; reason: string }[];
  requiresReview: boolean;
  confidenceScore: number;
}

interface MedicationSelectionResponse {
  requestId: string;
  indication: string;
  suggestions: MedicationSuggestion[];
  interactionSummary: {
    totalChecked: number;
    majorInteractions: number;
    moderateInteractions: number;
    minorInteractions: number;
  };
  allergyAlerts: string[];
  aiRationale: string;
  noCdsDisclaimer: string;
}

interface RefillRequest {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  quantity: number;
  daysSupply: number;
  pharmacy: string;
  prescriberName: string;
  status: string;
  aiGenerated: boolean;
  aiRationale?: string;
  urgency: string;
  lastFillDate: string;
  refillsRemaining: number;
  createdAt: string;
}

interface AdherenceIssue {
  id: string;
  patientName: string;
  medicationName: string;
  issueType: string;
  severity: string;
  description: string;
  metrics: {
    adherenceRate?: number;
    missedDoses?: number;
    avgDelayDays?: number;
    pattern?: string;
  };
  aiSuggestedInterventions: {
    type: string;
    description: string;
    priority: string;
    estimatedImpact: string;
  }[];
  riskFactors: string[];
}

interface AdherenceDashboard {
  patientName: string;
  overallAdherenceRate: number;
  medicationAdherence: {
    medicationName: string;
    adherenceRate: number;
    trend: string;
    lastTaken?: string;
    nextDue?: string;
  }[];
  activeIssues: AdherenceIssue[];
  recentInterventions: {
    type: string;
    description: string;
    appliedAt: string;
    outcome?: string;
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
}

function getSeverityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "major":
    case "contraindicated":
    case "high": return "destructive";
    case "moderate": return "default";
    default: return "secondary";
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4" />;
  }
}

export default function AIPrescriptionManagement() {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState("patient-1");
  const [indication, setIndication] = useState("");

  const { data: adherenceDashboard, isLoading: adherenceLoading } = useQuery<AdherenceDashboard>({
    queryKey: ["/api/ai-prescription/adherence/dashboard", selectedPatient],
  });

  const { data: refillsData, isLoading: refillsLoading } = useQuery<{ refills: RefillRequest[] }>({
    queryKey: ["/api/ai-prescription/refills"],
  });

  const suggestionMutation = useMutation({
    mutationFn: async (ind: string): Promise<MedicationSelectionResponse> => {
      const response = await apiRequest("POST", "/api/ai-prescription/medication-suggestions", {
        patientProfile: {
          patientId: selectedPatient,
          patientName: selectedPatient === "patient-1" ? "John Smith" : "Jane Doe",
          age: selectedPatient === "patient-1" ? 68 : 45,
          conditions: selectedPatient === "patient-1" ? ["Type 2 Diabetes", "Hypertension"] : ["Asthma"],
          allergies: selectedPatient === "patient-1" ? ["Penicillin"] : [],
          currentMedications: selectedPatient === "patient-1" ? [
            { id: "med-1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", startDate: "2022-06-15", prescriber: "Dr. Johnson" }
          ] : []
        },
        indication: ind
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Medication suggestions generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    }
  });

  const generateRefillsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ai-prescription/refills/generate/${selectedPatient}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Refill requests generated" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prescription/refills"] });
    },
    onError: () => {
      toast({ title: "Failed to generate refills", variant: "destructive" });
    }
  });

  const updateRefillMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/ai-prescription/refills/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Refill request updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-prescription/refills"] });
    }
  });

  const suggestions = suggestionMutation.data as MedicationSelectionResponse | undefined;
  const refills = refillsData?.refills || [];

  if (adherenceLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Pill className="h-8 w-8" />
              AI Prescription Management
            </h1>
            <p className="text-muted-foreground">
              AI-assisted medication selection, refills, and adherence monitoring
            </p>
          </div>
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
            <SelectTrigger className="w-48" data-testid="select-patient">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="patient-1">John Smith</SelectItem>
              <SelectItem value="patient-2">Jane Doe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Clinical Decision Support Disclaimer</AlertTitle>
          <AlertDescription>
            {adherenceDashboard?.noCdsDisclaimer || "AI assistance is for informational purposes only. All prescribing decisions require clinician review."}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Adherence Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-adherence-rate">
                {adherenceDashboard?.overallAdherenceRate?.toFixed(1) || 0}%
              </div>
              <Progress value={adherenceDashboard?.overallAdherenceRate || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-medications">
                {adherenceDashboard?.medicationAdherence?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">active prescriptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500" data-testid="text-issues">
                {adherenceDashboard?.activeIssues?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">adherence issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Refills Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-refills">
                {refills.filter(r => r.status === "pending_review").length}
              </div>
              <p className="text-xs text-muted-foreground">awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="selector" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="selector" data-testid="tab-selector">
              <Search className="h-4 w-4 mr-2 hidden sm:inline" />
              Medication Selector
            </TabsTrigger>
            <TabsTrigger value="refills" data-testid="tab-refills">
              <RefreshCw className="h-4 w-4 mr-2 hidden sm:inline" />
              Auto Refills
            </TabsTrigger>
            <TabsTrigger value="adherence" data-testid="tab-adherence">
              <Activity className="h-4 w-4 mr-2 hidden sm:inline" />
              Adherence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selector" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Medication Selection Assistant
                </CardTitle>
                <CardDescription>
                  Enter an indication to get AI-assisted medication suggestions with interaction checking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="indication">Indication / Condition</Label>
                    <Input
                      id="indication"
                      placeholder="e.g., Hypertension, Type 2 Diabetes, GERD..."
                      value={indication}
                      onChange={(e) => setIndication(e.target.value)}
                      data-testid="input-indication"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => suggestionMutation.mutate(indication)}
                      disabled={!indication || suggestionMutation.isPending}
                      data-testid="button-get-suggestions"
                    >
                      {suggestionMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Get Suggestions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {suggestions && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Interaction Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Checked: </span>
                        <span className="font-medium">{suggestions.interactionSummary.totalChecked}</span>
                      </div>
                      {suggestions.interactionSummary.majorInteractions > 0 && (
                        <Badge variant="destructive">
                          {suggestions.interactionSummary.majorInteractions} Major
                        </Badge>
                      )}
                      {suggestions.interactionSummary.moderateInteractions > 0 && (
                        <Badge variant="default">
                          {suggestions.interactionSummary.moderateInteractions} Moderate
                        </Badge>
                      )}
                      {suggestions.interactionSummary.minorInteractions > 0 && (
                        <Badge variant="secondary">
                          {suggestions.interactionSummary.minorInteractions} Minor
                        </Badge>
                      )}
                    </div>
                    {suggestions.allergyAlerts.length > 0 && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Allergy Alerts</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {suggestions.allergyAlerts.map((alert, i) => (
                              <li key={i}>{alert}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Alert className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <Shield className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs text-yellow-700 dark:text-yellow-400">
                    {suggestions.noCdsDisclaimer}
                  </AlertDescription>
                </Alert>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4" />
                    AI Rationale
                  </h4>
                  <p className="text-sm text-muted-foreground">{suggestions.aiRationale}</p>
                </div>

                <div className="grid gap-4">
                  {suggestions.suggestions.map((sug) => (
                    <Card key={sug.id} data-testid={`card-suggestion-${sug.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              {sug.medicationName}
                              {sug.requiresReview && (
                                <Badge variant="destructive">Review Required</Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              {sug.genericName} • {sug.drugClass}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {sug.suggestedDosage} {sug.frequency}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Confidence: {(sug.confidenceScore * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p>{sug.rationale}</p>
                        
                        {sug.considerations.length > 0 && (
                          <div>
                            <span className="font-medium">Considerations: </span>
                            <span className="text-muted-foreground">{sug.considerations.join(", ")}</span>
                          </div>
                        )}

                        {sug.interactionWarnings.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-medium text-red-500">Drug Interactions:</h5>
                            {sug.interactionWarnings.map((int, i) => (
                              <div key={i} className="p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getSeverityVariant(int.severity)}>{int.severity}</Badge>
                                  <span>{int.drug1} + {int.drug2}</span>
                                </div>
                                <p className="mt-1 text-muted-foreground">{int.description}</p>
                                <p className="mt-1"><strong>Management:</strong> {int.managementRecommendation}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {sug.contraindications.length > 0 && (
                          <div>
                            <span className="font-medium text-red-500">Contraindications: </span>
                            <span className="text-muted-foreground">{sug.contraindications.join(", ")}</span>
                          </div>
                        )}

                        {sug.alternatives.length > 0 && (
                          <div>
                            <span className="font-medium">Alternatives: </span>
                            {sug.alternatives.map((alt, i) => (
                              <Badge key={i} variant="outline" className="mr-1">{alt.name}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="refills" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">AI-Generated Refill Requests</h3>
              <Button
                onClick={() => generateRefillsMutation.mutate()}
                disabled={generateRefillsMutation.isPending}
                data-testid="button-generate-refills"
              >
                {generateRefillsMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Generate Refills
              </Button>
            </div>

            {refillsLoading ? (
              <Skeleton className="h-48" />
            ) : refills.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2" />
                  No refill requests. Click "Generate Refills" to identify needed refills.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {refills.map((refill) => (
                  <Card key={refill.id} data-testid={`card-refill-${refill.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {refill.medicationName} {refill.dosage}
                            {refill.aiGenerated && (
                              <Badge variant="outline">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Generated
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{refill.patientName} • {refill.pharmacy}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={refill.urgency === "urgent" ? "destructive" : "secondary"}>
                            {refill.urgency}
                          </Badge>
                          <Badge variant={
                            refill.status === "approved" || refill.status === "sent" ? "secondary" :
                            refill.status === "denied" ? "destructive" : "default"
                          }>
                            {refill.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <span className="text-muted-foreground">Qty: </span>
                          <span>{refill.quantity} ({refill.daysSupply} days)</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Refills remaining: </span>
                          <span>{refill.refillsRemaining}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last fill: </span>
                          <span>{format(new Date(refill.lastFillDate), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                      
                      {refill.aiRationale && (
                        <div className="p-2 bg-muted/50 rounded">
                          <span className="font-medium">AI Rationale: </span>
                          <span className="text-muted-foreground">{refill.aiRationale}</span>
                        </div>
                      )}

                      {refill.status === "pending_review" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => updateRefillMutation.mutate({ id: refill.id, status: "approved" })}
                            data-testid={`button-approve-${refill.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateRefillMutation.mutate({ id: refill.id, status: "denied" })}
                            data-testid={`button-deny-${refill.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateRefillMutation.mutate({ id: refill.id, status: "sent" })}
                            data-testid={`button-send-${refill.id}`}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send to Pharmacy
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="adherence" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Medication Adherence Dashboard</h3>

            {adherenceDashboard?.aiInsights && adherenceDashboard.aiInsights.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4" />
                  AI Adherence Insights
                </h4>
                <ul className="space-y-2">
                  {adherenceDashboard.aiInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {adherenceDashboard?.medicationAdherence?.map((med) => (
                <Card key={med.medicationName}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pill className="h-4 w-4" />
                        {med.medicationName}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(med.trend)}
                        <span className="text-xs capitalize">{med.trend}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Adherence</span>
                        <span className="font-medium">{med.adherenceRate}%</span>
                      </div>
                      <Progress value={med.adherenceRate} className="h-2" />
                      {med.lastTaken && (
                        <p className="text-xs text-muted-foreground">
                          Last taken: {formatDistanceToNow(new Date(med.lastTaken), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <h4 className="text-base font-medium mt-6">Active Adherence Issues</h4>
            {adherenceDashboard?.activeIssues?.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  No adherence issues identified
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {adherenceDashboard?.activeIssues?.map((issue) => (
                  <Card key={issue.id} data-testid={`card-issue-${issue.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {issue.medicationName}
                          </CardTitle>
                          <CardDescription>{issue.issueType.replace("_", " ")}</CardDescription>
                        </div>
                        <Badge variant={getSeverityVariant(issue.severity)}>{issue.severity}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>{issue.description}</p>
                      
                      {issue.metrics && (
                        <div className="flex flex-wrap gap-4 text-muted-foreground">
                          {issue.metrics.adherenceRate && (
                            <span>Adherence: {issue.metrics.adherenceRate}%</span>
                          )}
                          {issue.metrics.missedDoses && (
                            <span>Missed doses: {issue.metrics.missedDoses}</span>
                          )}
                          {issue.metrics.pattern && (
                            <span>Pattern: {issue.metrics.pattern}</span>
                          )}
                        </div>
                      )}

                      {issue.aiSuggestedInterventions.length > 0 && (
                        <div>
                          <h5 className="font-medium flex items-center gap-1 mb-2">
                            <Sparkles className="h-3 w-3" />
                            AI Suggested Interventions
                          </h5>
                          <div className="space-y-2">
                            {issue.aiSuggestedInterventions.map((int, i) => (
                              <div key={i} className="p-2 bg-muted/50 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline">{int.type.replace("_", " ")}</Badge>
                                  <Badge variant={int.priority === "high" ? "destructive" : int.priority === "medium" ? "default" : "secondary"}>
                                    {int.priority}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground">{int.description}</p>
                                <p className="text-xs mt-1"><strong>Expected impact:</strong> {int.estimatedImpact}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {issue.riskFactors.length > 0 && (
                        <div>
                          <span className="font-medium">Risk factors: </span>
                          {issue.riskFactors.map((rf, i) => (
                            <Badge key={i} variant="outline" className="mr-1">{rf}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
