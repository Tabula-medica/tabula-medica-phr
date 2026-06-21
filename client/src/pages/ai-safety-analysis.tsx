import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Pill,
  TestTube,
  HeartPulse,
  Dna,
  Link2,
  ArrowRight,
  Shield,
  Clock,
  ChevronRight,
  Loader2,
  FileWarning,
  Stethoscope,
  Zap,
} from "lucide-react";

function severityColor(severity: string) {
  switch (severity) {
    case "critical": return "bg-red-600 text-white";
    case "high": return "bg-orange-500 text-white";
    case "moderate": return "bg-yellow-500 text-black";
    case "low": return "bg-blue-500 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function severityBorder(severity: string) {
  switch (severity) {
    case "critical": return "border-l-red-600";
    case "high": return "border-l-orange-500";
    case "moderate": return "border-l-yellow-500";
    case "low": return "border-l-blue-500";
    default: return "border-l-gray-400";
  }
}

function riskScoreColor(level: string) {
  switch (level) {
    case "critical": return "text-red-600 dark:text-red-400";
    case "high": return "text-orange-600 dark:text-orange-400";
    case "moderate": return "text-yellow-600 dark:text-yellow-400";
    case "low": return "text-green-600 dark:text-green-400";
    default: return "text-gray-600";
  }
}

function riskProgressColor(level: string) {
  switch (level) {
    case "critical": return "[&>div]:bg-red-600";
    case "high": return "[&>div]:bg-orange-500";
    case "moderate": return "[&>div]:bg-yellow-500";
    case "low": return "[&>div]:bg-green-500";
    default: return "";
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "drug_interaction": return <Pill className="h-4 w-4" />;
    case "contraindication": return <ShieldAlert className="h-4 w-4" />;
    case "high_risk_alert": return <AlertTriangle className="h-4 w-4" />;
    case "pharmacogenomic_alert": return <Dna className="h-4 w-4" />;
    case "allergy_alert": return <FileWarning className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "drug_interaction": return "Drug Interaction";
    case "contraindication": return "Contraindication";
    case "high_risk_alert": return "High-Risk Alert";
    case "pharmacogenomic_alert": return "Pharmacogenomic";
    case "allergy_alert": return "Allergy Alert";
    default: return type.replace(/_/g, " ");
  }
}

export default function AISafetyAnalysis() {
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const patientsQuery = useQuery<any>({
    queryKey: ["/api/ai-safety/patients"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", "/api/ai-safety/analyze", { patientId });
      return res.json();
    },
  });

  const conditionLinksMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", "/api/ai-safety/condition-links", { patientId });
      return res.json();
    },
  });

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatient(patientId);
    analysisMutation.mutate(patientId);
    conditionLinksMutation.mutate(patientId);
  };

  const analysis = analysisMutation.data?.data;
  const conditionData = conditionLinksMutation.data?.data;
  const isLoading = analysisMutation.isPending || conditionLinksMutation.isPending;

  return (
    <div className="min-h-screen bg-background" data-testid="ai-safety-analysis-page">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="page-title">
                AI Proactive Safety Analysis
              </h1>
              <p className="text-muted-foreground text-sm">
                Drug interactions, contraindications, high-risk alerts & condition-linked diagnostics
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Patient</CardTitle>
            <CardDescription>Choose a patient to run proactive safety analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedPatient} onValueChange={handlePatientSelect} data-testid="patient-select">
                <SelectTrigger className="w-full sm:w-80" data-testid="patient-select-trigger">
                  <SelectValue placeholder="Select a patient..." />
                </SelectTrigger>
                <SelectContent>
                  {(patientsQuery.data?.data || []).map((p: any) => (
                    <SelectItem key={p.patientId} value={p.patientId} data-testid={`patient-option-${p.patientId}`}>
                      {p.patientName} ({p.patientId}) — {p.conditionCount} conditions, {p.medicationCount} meds
                      {p.hasGenomics ? " 🧬" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatient && (
                <Button
                  variant="outline"
                  onClick={() => handlePatientSelect(selectedPatient)}
                  disabled={isLoading}
                  data-testid="refresh-analysis-btn"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Re-analyze
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Running proactive safety analysis...</p>
                <p className="text-xs text-muted-foreground">Checking drug interactions, contraindications, genomics & condition links</p>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis && !isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className={`border-l-4 ${analysis.riskScore.level === "critical" ? "border-l-red-600" : analysis.riskScore.level === "high" ? "border-l-orange-500" : analysis.riskScore.level === "moderate" ? "border-l-yellow-500" : "border-l-green-500"}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium">Risk Score</p>
                      <p className={`text-3xl font-bold ${riskScoreColor(analysis.riskScore.level)}`} data-testid="risk-score-value">
                        {analysis.riskScore.score}
                      </p>
                    </div>
                    <Badge className={severityColor(analysis.riskScore.level)} data-testid="risk-level-badge">
                      {analysis.riskScore.level.toUpperCase()}
                    </Badge>
                  </div>
                  <Progress
                    value={analysis.riskScore.score}
                    className={`mt-2 h-2 ${riskProgressColor(analysis.riskScore.level)}`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-xs text-muted-foreground uppercase font-medium">Total Alerts</p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="total-alerts">{analysis.interactions.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analysis.interactions.filter((i: any) => i.severity === "critical").length} critical,{" "}
                    {analysis.interactions.filter((i: any) => i.severity === "high").length} high
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-blue-500" />
                    <p className="text-xs text-muted-foreground uppercase font-medium">Linked Results</p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="linked-results-count">{analysis.conditionLinks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Labs & vitals linked to conditions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Dna className="h-4 w-4 text-purple-500" />
                    <p className="text-xs text-muted-foreground uppercase font-medium">Genomic Alerts</p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="genomic-alerts-count">{analysis.genomicInsights?.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pharmacogenomic considerations
                  </p>
                </CardContent>
              </Card>
            </div>

            {analysis.overallAssessment && (
              <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 dark:text-blue-300">AI Safety Assessment</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400" data-testid="overall-assessment">
                  {analysis.overallAssessment}
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start flex-wrap h-auto gap-1" data-testid="analysis-tabs">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <Shield className="h-4 w-4 mr-1.5" /> Alerts Overview
                </TabsTrigger>
                <TabsTrigger value="interactions" data-testid="tab-interactions">
                  <Pill className="h-4 w-4 mr-1.5" /> Drug Interactions
                </TabsTrigger>
                <TabsTrigger value="condition-links" data-testid="tab-condition-links">
                  <Link2 className="h-4 w-4 mr-1.5" /> Condition Links
                </TabsTrigger>
                <TabsTrigger value="genomics" data-testid="tab-genomics">
                  <Dna className="h-4 w-4 mr-1.5" /> Genomics
                </TabsTrigger>
                <TabsTrigger value="monitoring" data-testid="tab-monitoring">
                  <Clock className="h-4 w-4 mr-1.5" /> Monitoring Plan
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" /> Risk Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysis.riskScore.factors.map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm" data-testid={`risk-factor-${i}`}>
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-red-500" /> Alert Summary by Severity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {["critical", "high", "moderate", "low"].map(sev => {
                          const count = analysis.interactions.filter((i: any) => i.severity === sev).length;
                          if (count === 0) return null;
                          return (
                            <div key={sev} className="flex items-center justify-between" data-testid={`severity-count-${sev}`}>
                              <div className="flex items-center gap-2">
                                <Badge className={`${severityColor(sev)} text-xs`}>
                                  {sev.toUpperCase()}
                                </Badge>
                                <span className="text-sm">{count} alert{count > 1 ? "s" : ""}</span>
                              </div>
                              <Progress value={(count / Math.max(analysis.interactions.length, 1)) * 100} className={`w-24 h-2 ${riskProgressColor(sev)}`} />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {analysis.conditionSpecificRisks && analysis.conditionSpecificRisks.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <HeartPulse className="h-4 w-4 text-red-500" /> Condition-Specific Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysis.conditionSpecificRisks.map((r: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg border-l-4 bg-muted/30 ${severityBorder(r.severity)}`} data-testid={`condition-risk-${i}`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm">{r.condition}</p>
                              <Badge className={`${severityColor(r.severity)} text-xs`}>{r.severity}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{r.risk || r.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="interactions" className="space-y-3 mt-4">
                <ScrollArea className="h-auto max-h-[700px]">
                  <div className="space-y-3 pr-3">
                    {analysis.interactions.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No drug interactions or safety alerts identified.
                        </CardContent>
                      </Card>
                    ) : (
                      analysis.interactions.map((interaction: any, i: number) => (
                        <Card key={interaction.id || i} className={`border-l-4 ${severityBorder(interaction.severity)}`} data-testid={`interaction-card-${i}`}>
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                {typeIcon(interaction.type)}
                                <h3 className="font-semibold text-sm">{interaction.title}</h3>
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <Badge className={`${severityColor(interaction.severity)} text-xs`}>
                                  {interaction.severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {typeLabel(interaction.type)}
                                </Badge>
                              </div>
                            </div>

                            {interaction.drugs && (
                              <div className="flex gap-1.5 mb-2">
                                {interaction.drugs.map((d: string, j: number) => (
                                  <Badge key={j} variant="secondary" className="text-xs">
                                    <Pill className="h-3 w-3 mr-1" />{d}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground mb-2">{interaction.description}</p>

                            {(interaction.labValue || interaction.vitalValue) && (
                              <div className="bg-muted/50 rounded px-3 py-1.5 mb-2 text-xs">
                                <span className="font-medium">Relevant Value: </span>
                                {interaction.labValue || interaction.vitalValue} {interaction.condition && `(${interaction.condition})`}
                              </div>
                            )}

                            {interaction.recommendation && (
                              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-2">
                                <ArrowRight className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-400">{interaction.recommendation}</p>
                              </div>
                            )}

                            {interaction.evidence && (
                              <p className="text-xs text-muted-foreground mt-2 italic">Evidence: {interaction.evidence}</p>
                            )}

                            {interaction.source === "ai_analysis" && (
                              <Badge variant="outline" className="mt-2 text-xs border-purple-300 text-purple-600">
                                AI-Identified
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="condition-links" className="space-y-4 mt-4">
                {conditionData?.conditionSummaries && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {conditionData.conditionSummaries.map((cs: any, i: number) => (
                      <Card key={i} className={`${cs.overallStatus === "needs_attention" ? "border-red-200 dark:border-red-800" : cs.overallStatus === "monitor" ? "border-yellow-200 dark:border-yellow-800" : ""}`} data-testid={`condition-summary-${i}`}>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{cs.condition}</p>
                              {cs.icdCode && <p className="text-xs text-muted-foreground">{cs.icdCode}</p>}
                            </div>
                            <Badge
                              className={
                                cs.overallStatus === "needs_attention"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : cs.overallStatus === "monitor"
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                  : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              }
                            >
                              {cs.overallStatus === "needs_attention" ? "Needs Attention" : cs.overallStatus === "monitor" ? "Monitor" : "Stable"}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><TestTube className="h-3 w-3" /> {cs.linkedLabCount} labs</span>
                            <span className="flex items-center gap-1"><HeartPulse className="h-3 w-3" /> {cs.linkedVitalCount} vitals</span>
                            {cs.abnormalCount > 0 && (
                              <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> {cs.abnormalCount} abnormal</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-500" /> Lab & Vital → Condition Mapping
                    </CardTitle>
                    <CardDescription>Automatic links between diagnostic results and patient conditions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-auto max-h-[600px]">
                      <div className="space-y-3 pr-3">
                        {analysis.conditionLinks.map((link: any, i: number) => (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border ${link.isAbnormal ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" : "border-border bg-muted/20"}`}
                            data-testid={`condition-link-${i}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {link.type === "lab" ? <TestTube className="h-4 w-4 text-purple-500" /> : <HeartPulse className="h-4 w-4 text-red-500" />}
                                <span className="font-medium text-sm">
                                  {link.type === "lab" ? link.labName : link.vitalType}
                                </span>
                                <span className="text-sm font-mono">
                                  {link.value} {link.unit}
                                </span>
                                {link.isAbnormal && (
                                  <Badge variant="destructive" className="text-xs">
                                    {link.flag || link.status}
                                  </Badge>
                                )}
                              </div>
                              {link.referenceRange && (
                                <span className="text-xs text-muted-foreground">Ref: {link.referenceRange}</span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              {link.linkedConditions.map((lc: any, j: number) => (
                                <Badge key={j} variant="outline" className="text-xs">
                                  {lc.name} {lc.icdCode && `(${lc.icdCode})`}
                                </Badge>
                              ))}
                            </div>

                            <p className="text-xs text-muted-foreground">{link.relevance}</p>

                            {link.linkedMedications && link.linkedMedications.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="text-xs text-muted-foreground">Treating:</span>
                                {link.linkedMedications.map((m: any, k: number) => (
                                  <Badge key={k} variant="secondary" className="text-xs">
                                    <Pill className="h-3 w-3 mr-1" />{m.name} {m.dosage}
                                    {m.efficacy && ` (${m.efficacy.trend})`}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="genomics" className="space-y-4 mt-4">
                {analysis.genomicInsights && analysis.genomicInsights.length > 0 ? (
                  <div className="space-y-3">
                    {analysis.genomicInsights.map((gi: any, i: number) => (
                      <Card key={i} className="border-l-4 border-l-purple-500" data-testid={`genomic-insight-${i}`}>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Dna className="h-4 w-4 text-purple-500" />
                            <h3 className="font-semibold text-sm">{gi.gene}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{gi.clinicalImpact}</p>
                          {gi.affectedDrugs && gi.affectedDrugs.length > 0 && (
                            <div className="flex gap-1.5 mb-2">
                              {gi.affectedDrugs.map((d: string, j: number) => (
                                <Badge key={j} variant="secondary" className="text-xs">{d}</Badge>
                              ))}
                            </div>
                          )}
                          {gi.recommendation && (
                            <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-950/30 rounded px-3 py-2">
                              <ArrowRight className="h-3.5 w-3.5 text-purple-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-purple-700 dark:text-purple-400">{gi.recommendation}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {analysis.interactions.filter((i: any) => i.type === "pharmacogenomic_alert").length > 0 && (
                      <>
                        <Separator />
                        <h3 className="font-medium text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" /> Pharmacogenomic Safety Alerts
                        </h3>
                        {analysis.interactions
                          .filter((i: any) => i.type === "pharmacogenomic_alert")
                          .map((alert: any, i: number) => (
                            <Card key={i} className={`border-l-4 ${severityBorder(alert.severity)}`}>
                              <CardContent className="pt-4 pb-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-semibold text-sm">{alert.title}</h3>
                                  <Badge className={`${severityColor(alert.severity)} text-xs`}>{alert.severity}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                                {alert.genomicData && (
                                  <div className="bg-muted/50 rounded px-3 py-1.5 mb-2 text-xs">
                                    {alert.genomicData.gene} {alert.genomicData.variant} — {alert.genomicData.phenotype}
                                  </div>
                                )}
                                {alert.recommendation && (
                                  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-2">
                                    <ArrowRight className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-blue-700 dark:text-blue-400">{alert.recommendation}</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                      </>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Dna className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No pharmacogenomic data available for this patient.</p>
                      <p className="text-xs text-muted-foreground mt-1">Genomic testing results would appear here when available.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Recommended Monitoring Plan
                    </CardTitle>
                    <CardDescription>AI-generated monitoring schedule based on conditions, medications, and identified risks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analysis.monitoringRecommendations && analysis.monitoringRecommendations.length > 0 ? (
                      <div className="space-y-3">
                        {["urgent", "routine"].map(priority => {
                          const recs = analysis.monitoringRecommendations.filter((r: any) => r.priority === priority);
                          if (recs.length === 0) return null;
                          return (
                            <div key={priority}>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                {priority === "urgent" ? (
                                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Routine</Badge>
                                )}
                              </h4>
                              <div className="space-y-2">
                                {recs.map((rec: any, i: number) => (
                                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20" data-testid={`monitoring-rec-${priority}-${i}`}>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <p className="font-medium text-sm">{rec.parameter}</p>
                                        <Badge variant="outline" className="text-xs">{rec.frequency}</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No specific monitoring recommendations generated.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Alert variant="default" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-300 text-xs">Important Disclaimer</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs" data-testid="safety-disclaimer">
                {analysis.disclaimer}
              </AlertDescription>
            </Alert>
          </>
        )}

        {!selectedPatient && !isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">Proactive Patient Safety Analysis</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">
                Select a patient above to run AI-powered safety analysis including drug interaction detection,
                contraindication checks, pharmacogenomic alerts, and automatic lab/vital-to-condition linking.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
