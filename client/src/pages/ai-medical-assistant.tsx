import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  User,
  Pill,
  Activity,
  AlertTriangle,
  FileText,
  Calendar,
  Stethoscope,
  Heart,
  XCircle,
  Loader2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface PatientHistorySummary {
  overview: string;
  conditions: Array<{ name: string; status: string; onsetDate?: string; notes?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; purpose?: string }>;
  recentLabHighlights: Array<{ test: string; value: string; status: "normal" | "abnormal" | "critical"; interpretation?: string }>;
  keyVitals: Array<{ type: string; value: string; trend?: string }>;
  allergies: string[];
  riskFactors: string[];
  careGaps: string[];
  noCdsDisclaimer: string;
}

interface ConsultationSummary {
  consultationId: string;
  date: string;
  provider: string;
  specialty: string;
  chiefComplaint: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  followUpNeeded: boolean;
  followUpDetails?: string;
  noCdsDisclaimer: string;
}

interface SamplePatient {
  id: string;
  name: string;
  conditions: string[];
}

export default function AIMedicalAssistant() {
  const [selectedPatient, setSelectedPatient] = useState<string>("patient-001");
  const [activeTab, setActiveTab] = useState("history");

  const { data: samplePatients, isLoading: patientsLoading } = useQuery<{ success: boolean; data: SamplePatient[] }>({
    queryKey: ["/api/medical-assistant/sample-patients"],
  });

  const {
    data: historySummary,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<{ success: boolean; data: PatientHistorySummary; patientInfo: { id: string; name: string; dateOfBirth: string; gender: string } }>({
    queryKey: ["/api/medical-assistant/patient", selectedPatient, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/medical-assistant/patient/${selectedPatient}/summary`);
      if (!res.ok) throw new Error("Failed to fetch patient summary");
      return res.json();
    },
    enabled: !!selectedPatient,
  });

  const {
    data: consultationSummaries,
    isLoading: consultationsLoading,
    error: consultationsError,
    refetch: refetchConsultations,
  } = useQuery<{ success: boolean; data: { summaries: ConsultationSummary[]; overallPattern: string; noCdsDisclaimer: string }; patientInfo: { id: string; name: string } }>({
    queryKey: ["/api/medical-assistant/patient", selectedPatient, "consultations"],
    queryFn: async () => {
      const res = await fetch(`/api/medical-assistant/patient/${selectedPatient}/consultations`);
      if (!res.ok) throw new Error("Failed to fetch consultation summaries");
      return res.json();
    },
    enabled: !!selectedPatient,
  });

  const handlePatientChange = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "destructive";
      case "controlled":
      case "well-controlled":
        return "default";
      case "resolved":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getLabStatusColor = (status: "normal" | "abnormal" | "critical") => {
    switch (status) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "abnormal":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-green-600 dark:text-green-400";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Medical Assistant</h1>
              <p className="text-muted-foreground">AI-powered patient history and consultation summaries</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedPatient} onValueChange={handlePatientChange}>
              <SelectTrigger className="w-[200px]" data-testid="select-patient">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patientsLoading ? (
                  <div className="p-2"><Skeleton className="h-8" /></div>
                ) : (
                  samplePatients?.data.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id} data-testid={`option-patient-${patient.id}`}>
                      {patient.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                refetchHistory();
                refetchConsultations();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">NO-CDS Compliance Notice</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  This AI assistant provides informational summaries only and does not constitute medical advice, clinical decision support, diagnosis, or treatment recommendations. Always consult qualified healthcare providers for clinical decisions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {historySummary?.patientInfo && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-patient-name">{historySummary.patientInfo.name}</span>
                </div>
                <Badge variant="outline">{historySummary.patientInfo.gender}</Badge>
                <Badge variant="outline">DOB: {historySummary.patientInfo.dateOfBirth}</Badge>
                <Badge variant="outline">ID: {historySummary.patientInfo.id}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history" data-testid="tab-history">
              <ClipboardList className="h-4 w-4 mr-2" />
              Medical History Summary
            </TabsTrigger>
            <TabsTrigger value="consultations" data-testid="tab-consultations">
              <Stethoscope className="h-4 w-4 mr-2" />
              Consultation Summaries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            {historyLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                </div>
              </div>
            ) : historyError ? (
              <Card>
                <CardContent className="p-8 text-center" data-testid="error-history">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <p className="text-lg font-medium">Failed to load patient summary</p>
                  <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
                  <Button onClick={() => refetchHistory()} className="mt-4" data-testid="button-retry-history">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : historySummary?.data ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="text-overview">{historySummary.data.overview}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Heart className="h-5 w-5" />
                        Active Conditions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-3">
                          {historySummary.data.conditions.map((condition, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-2 p-2 rounded bg-muted/50" data-testid={`condition-${idx}`}>
                              <div>
                                <p className="font-medium text-sm">{condition.name}</p>
                                {condition.onsetDate && (
                                  <p className="text-xs text-muted-foreground">Onset: {condition.onsetDate}</p>
                                )}
                              </div>
                              <Badge variant={getStatusBadgeVariant(condition.status)}>{condition.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Pill className="h-5 w-5" />
                        Current Medications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-3">
                          {historySummary.data.medications.map((med, idx) => (
                            <div key={idx} className="p-2 rounded bg-muted/50" data-testid={`medication-${idx}`}>
                              <p className="font-medium text-sm">{med.name}</p>
                              <p className="text-xs text-muted-foreground">{med.dosage} - {med.frequency}</p>
                              {med.purpose && <p className="text-xs text-primary mt-1">{med.purpose}</p>}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="h-5 w-5" />
                        Recent Lab Highlights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {historySummary.data.recentLabHighlights.map((lab, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid={`lab-${idx}`}>
                              <span className="text-sm">{lab.test}</span>
                              <span className={`font-medium text-sm ${getLabStatusColor(lab.status)}`}>{lab.value}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="h-5 w-5" />
                        Key Vitals
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {historySummary.data.keyVitals.map((vital, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid={`vital-${idx}`}>
                              <span className="text-sm">{vital.type}</span>
                              <div className="text-right">
                                <span className="font-medium text-sm">{vital.value}</span>
                                {vital.trend && <span className="text-xs text-muted-foreground ml-2">({vital.trend})</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                {(historySummary.data.allergies.length > 0 || historySummary.data.riskFactors.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Allergies & Risk Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Known Allergies</h4>
                          <div className="flex flex-wrap gap-2">
                            {historySummary.data.allergies.map((allergy, idx) => (
                              <Badge key={idx} variant="destructive" data-testid={`allergy-${idx}`}>{allergy}</Badge>
                            ))}
                            {historySummary.data.allergies.length === 0 && (
                              <span className="text-sm text-muted-foreground">No known allergies documented</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Risk Factors</h4>
                          <div className="flex flex-wrap gap-2">
                            {historySummary.data.riskFactors.map((risk, idx) => (
                              <Badge key={idx} variant="outline" data-testid={`risk-${idx}`}>{risk}</Badge>
                            ))}
                            {historySummary.data.riskFactors.length === 0 && (
                              <span className="text-sm text-muted-foreground">No documented risk factors</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="consultations" className="space-y-4">
            {consultationsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : consultationsError ? (
              <Card>
                <CardContent className="p-8 text-center" data-testid="error-consultations">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <p className="text-lg font-medium">Failed to load consultation summaries</p>
                  <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
                  <Button onClick={() => refetchConsultations()} className="mt-4" data-testid="button-retry-consultations">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : consultationSummaries?.data ? (
              <>
                {consultationSummaries.data.overallPattern && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Visit Pattern
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground" data-testid="text-pattern">{consultationSummaries.data.overallPattern}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Consultations</CardTitle>
                    <CardDescription>AI-generated summaries of recent healthcare visits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {consultationSummaries.data.summaries.map((consult, idx) => (
                        <AccordionItem key={consult.consultationId} value={consult.consultationId} data-testid={`consultation-${idx}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-start justify-between w-full pr-4">
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{consult.provider}</span>
                                  <Badge variant="outline" className="text-xs">{consult.specialty}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{consult.chiefComplaint}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm text-muted-foreground">{consult.date}</span>
                                {consult.followUpNeeded && (
                                  <Badge variant="secondary" className="ml-2">Follow-up needed</Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">Summary</h4>
                                <p className="text-sm text-muted-foreground">{consult.summary}</p>
                              </div>

                              {consult.findings.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Key Findings</h4>
                                  <ul className="list-disc list-inside space-y-1">
                                    {consult.findings.map((finding, fIdx) => (
                                      <li key={fIdx} className="text-sm text-muted-foreground">{finding}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {consult.recommendations.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Provider Recommendations</h4>
                                  <ul className="list-disc list-inside space-y-1">
                                    {consult.recommendations.map((rec, rIdx) => (
                                      <li key={rIdx} className="text-sm text-muted-foreground">{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {consult.followUpDetails && (
                                <div className="p-3 bg-muted rounded">
                                  <p className="text-sm"><strong>Follow-up:</strong> {consult.followUpDetails}</p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
