import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, 
  FileText, 
  Activity, 
  Pill, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  RefreshCw, 
  Sparkles,
  Clock,
  Heart,
  Stethoscope,
  Shield,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  History
} from "lucide-react";

interface PatientOption {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
}

interface SummarySection {
  title: string;
  content: string;
  priority: "critical" | "high" | "medium" | "low";
  dataPoints: number;
}

interface KeyInsight {
  type: string;
  title: string;
  description: string;
  severity?: "critical" | "warning" | "info";
  relatedResources?: string[];
}

interface PatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  executiveSummary: string;
  sections: SummarySection[];
  keyInsights: KeyInsight[];
  medicalHistory: {
    summary: string;
    significantEvents: string[];
  };
  activeConditions: {
    summary: string;
    conditions: Array<{ name: string; status: string; notes?: string }>;
  };
  currentMedications: {
    summary: string;
    medications: Array<{ name: string; dosage?: string; purpose?: string }>;
    interactions?: string[];
  };
  recentEvents: {
    summary: string;
    events: Array<{ date: string; type: string; description: string }>;
  };
  actionableInsights: string[];
  dataQuality: {
    completeness: number;
    lastUpdated: string;
    missingDataAreas: string[];
  };
  noCdsCompliance: string;
  disclaimer: string;
}

interface Metadata {
  version: string;
  features: string[];
  noCdsCompliance: string;
}

export default function AIPatientSummaryGeneratorPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("summary");
  const [generatedSummary, setGeneratedSummary] = useState<PatientSummary | null>(null);

  const { data: patients, isLoading: patientsLoading, isError: patientsError, refetch: refetchPatients } = useQuery<PatientOption[]>({
    queryKey: ["/api/patient-summary-generator/patients"],
    queryFn: async () => {
      const response = await fetch("/api/patient-summary-generator/patients");
      if (!response.ok) throw new Error("Failed to fetch patients");
      return response.json();
    }
  });

  const { data: metadata } = useQuery<Metadata>({
    queryKey: ["/api/patient-summary-generator/metadata"],
    queryFn: async () => {
      const response = await fetch("/api/patient-summary-generator/metadata");
      if (!response.ok) throw new Error("Failed to fetch metadata");
      return response.json();
    }
  });

  const { data: summaryHistory, refetch: refetchHistory } = useQuery<PatientSummary[]>({
    queryKey: ["/api/patient-summary-generator/history", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const response = await fetch(`/api/patient-summary-generator/history/${selectedPatientId}`);
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: !!selectedPatientId
  });

  const generateMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest("POST", "/api/patient-summary-generator/generate", {
        patientId,
        timeframeDays: 365,
        includeInsights: true
      });
      return response.json() as Promise<PatientSummary>;
    },
    onSuccess: (data) => {
      setGeneratedSummary(data);
      queryClient.invalidateQueries({ queryKey: ["/api/patient-summary-generator/history", selectedPatientId] });
    }
  });

  const handleGenerateSummary = () => {
    if (selectedPatientId) {
      generateMutation.mutate(selectedPatientId);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-destructive";
      case "high": return "bg-chart-5";
      case "medium": return "bg-chart-4";
      case "low": return "bg-chart-2";
      default: return "bg-muted-foreground";
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical": return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-chart-4 dark:text-chart-4" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive" data-testid="badge-severity-critical">Critical</Badge>;
      case "warning": return <Badge variant="secondary" data-testid="badge-severity-warning">Warning</Badge>;
      default: return <Badge variant="secondary" data-testid="badge-severity-info">Info</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <Sparkles className="w-8 h-8 text-chart-5 dark:text-chart-5" />
            AI Patient Summary Generator
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Generate intelligent, concise patient summaries from FHIR health records
          </p>
        </div>
        {metadata && (
          <Badge variant="outline" className="text-xs" data-testid="badge-version">
            v{metadata.version}
          </Badge>
        )}
      </div>

      {metadata?.noCdsCompliance && (
        <Alert className="border-chart-1/30 bg-chart-1/10 dark:bg-chart-1/20 dark:border-chart-1/40" data-testid="alert-compliance">
          <Shield className="h-4 w-4 text-chart-1 dark:text-chart-1" />
          <AlertTitle data-testid="text-compliance-title">Compliance Notice</AlertTitle>
          <AlertDescription className="text-sm" data-testid="text-compliance-desc">
            {metadata.noCdsCompliance}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Select Patient
            </CardTitle>
            <CardDescription>
              Choose a patient to generate their summary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {patientsError ? (
              <div className="text-center py-4" data-testid="patients-error">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Failed to load patients</p>
                <Button variant="outline" size="sm" onClick={() => refetchPatients()} className="mt-2" data-testid="button-retry-patients">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : (
              <Select
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                disabled={patientsLoading}
                data-testid="select-patient"
              >
                <SelectTrigger data-testid="select-patient-trigger">
                  <SelectValue placeholder={patientsLoading ? "Loading..." : "Select a patient"} />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id} data-testid={`patient-option-${patient.id}`}>
                      <div className="flex flex-col">
                        <span>{patient.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {patient.gender} - DOB: {patient.dateOfBirth}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              className="w-full"
              onClick={handleGenerateSummary}
              disabled={!selectedPatientId || generateMutation.isPending}
              data-testid="button-generate-summary"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>

            {generateMutation.isError && (
              <Alert variant="destructive" data-testid="alert-generation-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to generate summary. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {summaryHistory && summaryHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1" data-testid="text-history-header">
                  <History className="w-4 h-4" />
                  Recent Summaries
                </h4>
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {summaryHistory.slice(0, 5).map((summary) => (
                      <Button
                        key={summary.id}
                        variant="ghost"
                        className="w-full justify-between p-2 h-auto"
                        onClick={() => setGeneratedSummary(summary)}
                        data-testid={`history-item-${summary.id}`}
                      >
                        <span className="text-xs text-muted-foreground">
                          {new Date(summary.generatedAt).toLocaleDateString()}
                        </span>
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Patient Summary
            </CardTitle>
            {generatedSummary && (
              <CardDescription data-testid="text-summary-header">
                Generated for {generatedSummary.patientName} on{" "}
                {new Date(generatedSummary.generatedAt).toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!generatedSummary ? (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a patient and click "Generate Summary" to create an AI-powered summary
                </p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5" data-testid="tabs-list">
                  <TabsTrigger value="summary" data-testid="tab-summary">Overview</TabsTrigger>
                  <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
                  <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
                  <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
                  <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Stethoscope className="w-5 h-5" />
                        Executive Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm" data-testid="executive-summary">
                        {generatedSummary.executiveSummary}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedSummary.sections.map((section, index) => (
                      <Card key={index} data-testid={`section-card-${index}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm" data-testid={`section-title-${index}`}>{section.title}</CardTitle>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${getPriorityColor(section.priority)}`} data-testid={`section-priority-${index}`} />
                              <Badge variant="outline" className="text-xs" data-testid={`badge-section-records-${index}`}>
                                {section.dataPoints} records
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground" data-testid={`section-content-${index}`}>{section.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Data Quality
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium">Completeness:</span>
                        <div className="flex-1 bg-secondary rounded-full h-2" data-testid="progress-bar-completeness">
                          <div
                            className="bg-chart-1 dark:bg-chart-1 rounded-full h-2"
                            style={{ width: `${generatedSummary.dataQuality.completeness}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold" data-testid="text-completeness-value">
                          {generatedSummary.dataQuality.completeness}%
                        </span>
                      </div>
                      {generatedSummary.dataQuality.missingDataAreas.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground" data-testid="text-missing-areas-label">Missing areas:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {generatedSummary.dataQuality.missingDataAreas.map((area, i) => (
                              <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-missing-area-${i}`}>
                                {area}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conditions" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-destructive" />
                        Active Conditions
                      </CardTitle>
                      <CardDescription data-testid="text-conditions-summary">{generatedSummary.activeConditions.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {generatedSummary.activeConditions.conditions.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-no-conditions">No active conditions documented.</p>
                      ) : (
                        <div className="space-y-3">
                          {generatedSummary.activeConditions.conditions.map((condition, index) => (
                            <div key={index} className="flex items-start justify-between p-3 border rounded-lg" data-testid={`condition-item-${index}`}>
                              <div>
                                <p className="font-medium" data-testid={`condition-name-${index}`}>{condition.name}</p>
                                {condition.notes && (
                                  <p className="text-sm text-muted-foreground mt-1" data-testid={`condition-notes-${index}`}>{condition.notes}</p>
                                )}
                              </div>
                              <Badge variant={condition.status === "active" ? "default" : "secondary"} data-testid={`badge-condition-status-${index}`}>
                                {condition.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Medical History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-3" data-testid="text-medical-history-summary">{generatedSummary.medicalHistory.summary}</p>
                      {generatedSummary.medicalHistory.significantEvents.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Significant Events:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {generatedSummary.medicalHistory.significantEvents.map((event, i) => (
                              <li key={i} className="text-sm text-muted-foreground" data-testid={`significant-event-${i}`}>{event}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="medications" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Pill className="w-5 h-5 text-chart-1 dark:text-chart-1" />
                        Current Medications
                      </CardTitle>
                      <CardDescription data-testid="text-medications-summary">{generatedSummary.currentMedications.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {generatedSummary.currentMedications.medications.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-no-medications">No active medications documented.</p>
                      ) : (
                        <div className="space-y-3">
                          {generatedSummary.currentMedications.medications.map((med, index) => (
                            <div key={index} className="p-3 border rounded-lg" data-testid={`medication-item-${index}`}>
                              <div className="flex items-center justify-between">
                                <p className="font-medium" data-testid={`medication-name-${index}`}>{med.name}</p>
                                {med.dosage && (
                                  <Badge variant="outline" data-testid={`badge-medication-dosage-${index}`}>{med.dosage}</Badge>
                                )}
                              </div>
                              {med.purpose && (
                                <p className="text-sm text-muted-foreground mt-1" data-testid={`medication-purpose-${index}`}>{med.purpose}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {generatedSummary.currentMedications.interactions && 
                       generatedSummary.currentMedications.interactions.length > 0 && (
                        <div className="mt-4">
                          <Separator className="mb-4" />
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-chart-4 dark:text-chart-4" />
                            Documented Considerations
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {generatedSummary.currentMedications.interactions.map((interaction, i) => (
                              <li key={i} className="text-sm text-muted-foreground" data-testid={`interaction-item-${i}`}>{interaction}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="events" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-chart-2 dark:text-chart-2" />
                        Recent Healthcare Events
                      </CardTitle>
                      <CardDescription data-testid="text-events-summary">{generatedSummary.recentEvents.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {generatedSummary.recentEvents.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-no-events">No recent events documented.</p>
                      ) : (
                        <div className="space-y-3">
                          {generatedSummary.recentEvents.events.map((event, index) => (
                            <div key={index} className="flex items-start gap-4 p-3 border rounded-lg" data-testid={`event-item-${index}`}>
                              <div className="flex flex-col items-center">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground mt-1">{event.date}</span>
                              </div>
                              <div className="flex-1">
                                <Badge variant="outline" className="mb-1" data-testid={`badge-event-type-${index}`}>{event.type}</Badge>
                                <p className="text-sm" data-testid={`event-desc-${index}`}>{event.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insights" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-chart-5 dark:text-chart-5" />
                        Key Insights
                      </CardTitle>
                      <CardDescription data-testid="text-insights-desc">
                        AI-identified patterns and observations from the patient's health records
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {generatedSummary.keyInsights.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-no-insights">No insights available.</p>
                      ) : (
                        <div className="space-y-3">
                          {generatedSummary.keyInsights.map((insight, index) => (
                            <div key={index} className="p-4 border rounded-lg" data-testid={`key-insight-item-${index}`}>
                              <div className="flex items-center gap-2 mb-2">
                                {getSeverityIcon(insight.severity)}
                                <span className="font-medium" data-testid={`key-insight-title-${index}`}>{insight.title}</span>
                                {getSeverityBadge(insight.severity)}
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`key-insight-desc-${index}`}>{insight.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {generatedSummary.actionableInsights.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-chart-2 dark:text-chart-2" />
                          Data Observations
                        </CardTitle>
                        <CardDescription data-testid="text-observations-desc">
                          Factual observations about the patient's documented data
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {generatedSummary.actionableInsights.map((insight, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm" data-testid={`insight-item-${index}`}>
                              <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {generatedSummary && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center" data-testid="text-disclaimer">
                  {generatedSummary.disclaimer}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
