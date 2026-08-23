import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Search,
  Pill,
  AlertTriangle,
  Stethoscope,
  Activity,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Loader2,
  ClipboardList,
  FileSearch,
  Brain,
  ArrowRight
} from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { clickable } from "@/lib/a11y";

interface ExtractedDiagnosis {
  code?: string;
  description: string;
  status: "active" | "resolved" | "historical";
  dateIdentified?: string;
  source: string;
}

interface ExtractedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: "active" | "discontinued" | "as-needed";
  prescriber?: string;
  startDate?: string;
  source: string;
}

interface ExtractedAllergy {
  allergen: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe" | "life-threatening" | "unknown";
  source: string;
}

interface PatientRecordSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  recordCount: number;
  dateRange: { from: string; to: string };
  quickOverview: string;
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  allergies: ExtractedAllergy[];
  clinicalNoteSummaries: {
    noteId: string;
    noteType: string;
    date: string;
    provider: string;
    summary: string;
    keyFindings: string[];
  }[];
  recentVisits: {
    date: string;
    type: string;
    provider: string;
    reason: string;
    outcome: string;
  }[];
  labTrends: {
    testName: string;
    recentValue: string;
    trend: "improving" | "stable" | "worsening" | "new";
    normalRange?: string;
  }[];
  disclaimer: string;
}

interface SearchResult {
  recordId: string;
  patientId: string;
  matchType: "diagnosis" | "medication" | "allergy" | "note" | "visit" | "lab";
  matchedTerm: string;
  context: string;
  date?: string;
  relevanceScore: number;
}

interface ReviewStats {
  totalPatients: number;
  totalRecords: number;
  diagnosesExtracted: number;
  medicationsTracked: number;
  allergiesLogged: number;
  noteSummaries: number;
}

export default function MedicalRecordReview() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [noteToSummarize, setNoteToSummarize] = useState("");

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: ReviewStats }>({
    queryKey: ["/api/medical-record-review/stats"]
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery<{ success: boolean; data: PatientRecordSummary[] }>({
    queryKey: ["/api/medical-record-review/patients"]
  });

  const { data: searchResults, isLoading: searchLoading, refetch: executeSearch } = useQuery<{ success: boolean; data: { query: string; resultCount: number; results: SearchResult[] } }>({
    queryKey: ["/api/medical-record-review/search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/medical-record-review/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: false
  });

  const summarizeNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/medical-record-review/summarize-note", {
        noteContent: noteToSummarize,
        noteType: "Clinical Note"
      });
    },
    onSuccess: () => {
      toast({ title: "Note summarized successfully" });
    },
    onError: () => {
      toast({ title: "Failed to summarize note", variant: "destructive" });
    }
  });

  const stats = statsData?.data;
  const patients = patientsData?.data || [];
  const selectedPatientData = patients.find(p => p.patientId === selectedPatient);

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      executeSearch();
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "stable": return <Minus className="h-4 w-4 text-gray-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "life-threatening": return <Badge variant="destructive">Life-Threatening</Badge>;
      case "severe": return <Badge variant="destructive">Severe</Badge>;
      case "moderate": return <Badge variant="secondary">Moderate</Badge>;
      case "mild": return <Badge variant="outline">Mild</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const labelMap: Record<string, string> = { "as-needed": "PRN", "historical": "Historical" };
    return <StatusBadge status={status} label={labelMap[status]} />;
  };

  const getMatchTypeBadge = (type: string) => {
    switch (type) {
      case "diagnosis": return <Badge variant="destructive">Diagnosis</Badge>;
      case "medication": return <Badge variant="default">Medication</Badge>;
      case "allergy": return <Badge variant="secondary" className="border-red-500 text-red-600 dark:text-red-400">Allergy</Badge>;
      case "note": return <Badge variant="outline">Note</Badge>;
      case "lab": return <Badge variant="secondary">Lab</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <FileSearch className="h-8 w-8 text-primary" />
          Medical Record Review
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered medical record summarization, key information extraction, and search
        </p>
      </div>

      <Alert className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>AI Review Disclaimer:</strong> AI-generated summaries and extracted information are for INFORMATIONAL purposes only. They do NOT constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare professionals who have reviewed the complete medical record.
        </AlertDescription>
      </Alert>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-total-patients">{stats.totalPatients}</div>
              <div className="text-sm text-muted-foreground">Patients</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-total-records">{stats.totalRecords}</div>
              <div className="text-sm text-muted-foreground">Records</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.diagnosesExtracted}</div>
              <div className="text-sm text-muted-foreground">Diagnoses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.medicationsTracked}</div>
              <div className="text-sm text-muted-foreground">Medications</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.allergiesLogged}</div>
              <div className="text-sm text-muted-foreground">Allergies</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.noteSummaries}</div>
              <div className="text-sm text-muted-foreground">Note Summaries</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList data-testid="tabs-record-review">
          <TabsTrigger value="patients" data-testid="tab-patients">
            <User className="h-4 w-4 mr-1" />
            Patients
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="h-4 w-4 mr-1" />
            Search Records
          </TabsTrigger>
          <TabsTrigger value="summarize" data-testid="tab-summarize">
            <Brain className="h-4 w-4 mr-1" />
            Summarize Note
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Patient List
                </CardTitle>
                <CardDescription>Select a patient to view their record summary</CardDescription>
              </CardHeader>
              <CardContent>
                {patientsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {patients.map(patient => (
                        <div
                          key={patient.patientId}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                            selectedPatient === patient.patientId ? "border-primary bg-primary/5" : ""
                          }`}
                          {...clickable(() => setSelectedPatient(patient.patientId))}
                          data-testid={`card-patient-${patient.patientId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{patient.patientName}</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {patient.recordCount} records | {patient.diagnoses.length} diagnoses
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Record Summary
                </CardTitle>
                <CardDescription>
                  {selectedPatientData 
                    ? `AI-extracted information for ${selectedPatientData.patientName}` 
                    : "Select a patient to view their summary"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedPatientData ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Select a patient from the list to view their record summary
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <h4 className="font-semibold mb-2">Quick Overview</h4>
                        <p className="text-sm" data-testid="text-quick-overview">{selectedPatientData.quickOverview}</p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Records: {selectedPatientData.dateRange.from} to {selectedPatientData.dateRange.to}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Allergies ({selectedPatientData.allergies.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedPatientData.allergies.map((allergy, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded border bg-red-50 dark:bg-red-950/20">
                              <div>
                                <span className="font-medium">{allergy.allergen}</span>
                                {allergy.reaction && (
                                  <span className="text-sm text-muted-foreground ml-2">- {allergy.reaction}</span>
                                )}
                              </div>
                              {getSeverityBadge(allergy.severity)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Diagnoses ({selectedPatientData.diagnoses.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedPatientData.diagnoses.map((dx, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded border">
                              <div>
                                <span className="font-medium">{dx.description}</span>
                                {dx.code && <Badge variant="outline" className="ml-2 text-xs">{dx.code}</Badge>}
                                <div className="text-xs text-muted-foreground mt-1">{dx.source}</div>
                              </div>
                              {getStatusBadge(dx.status)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Medications ({selectedPatientData.medications.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedPatientData.medications.map((med, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded border">
                              <div>
                                <span className="font-medium">{med.name}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  {med.dosage} {med.frequency}
                                </span>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Prescribed by {med.prescriber || "Unknown"}
                                </div>
                              </div>
                              {getStatusBadge(med.status)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Lab Trends
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedPatientData.labTrends.map((lab, i) => (
                            <div key={i} className="p-2 rounded border">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{lab.testName}</span>
                                {getTrendIcon(lab.trend)}
                              </div>
                              <div className="text-lg font-bold">{lab.recentValue}</div>
                              {lab.normalRange && (
                                <div className="text-xs text-muted-foreground">Normal: {lab.normalRange}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Clinical Note Summaries
                        </h4>
                        <div className="space-y-3">
                          {selectedPatientData.clinicalNoteSummaries.map((note, i) => (
                            <div key={i} className="p-3 rounded border">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline">{note.noteType}</Badge>
                                <span className="text-sm text-muted-foreground">{note.date}</span>
                              </div>
                              <div className="text-sm font-medium mb-1">{note.provider}</div>
                              <p className="text-sm text-muted-foreground">{note.summary}</p>
                              {note.keyFindings.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs font-medium mb-1">Key Findings:</div>
                                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                                    {note.keyFindings.map((finding, j) => (
                                      <li key={j}>{finding}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Medical Records
              </CardTitle>
              <CardDescription>
                Search for diagnoses, medications, allergies, and clinical notes across all patient records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search for terms like 'diabetes', 'metformin', 'penicillin'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                  data-testid="input-search"
                />
                <Button onClick={handleSearch} disabled={searchLoading || searchQuery.length < 2} data-testid="button-search">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>

              {searchResults?.data && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Found {searchResults.data.resultCount} results for "{searchResults.data.query}"
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {searchResults.data.results.map((result, i) => (
                        <div key={i} className="p-3 rounded border hover-elevate">
                          <div className="flex items-center gap-2 mb-1">
                            {getMatchTypeBadge(result.matchType)}
                            <span className="font-medium">{result.matchedTerm}</span>
                            {result.date && (
                              <span className="text-xs text-muted-foreground ml-auto">{result.date}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{result.context}</p>
                          <div className="text-xs text-muted-foreground mt-1">
                            Patient ID: {result.patientId}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summarize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Clinical Note Summarization
              </CardTitle>
              <CardDescription>
                Paste a clinical note to extract key information and generate a summary
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Paste clinical note content here..."
                  value={noteToSummarize}
                  onChange={(e) => setNoteToSummarize(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-note-content"
                />
                <Button 
                  onClick={() => summarizeNoteMutation.mutate()}
                  disabled={summarizeNoteMutation.isPending || noteToSummarize.length < 10}
                  data-testid="button-summarize"
                >
                  {summarizeNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Summarize & Extract Key Information
                </Button>

                {summarizeNoteMutation.data && (
                  <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <p className="text-sm">{(summarizeNoteMutation.data as any).data?.summary}</p>
                    </div>
                    {(summarizeNoteMutation.data as any).data?.keyFindings?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Key Findings</h4>
                        <ul className="list-disc list-inside text-sm">
                          {(summarizeNoteMutation.data as any).data.keyFindings.map((finding: string, i: number) => (
                            <li key={i}>{finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {["diagnoses", "medications", "allergies", "procedures", "labs"].map(type => (
                        <div key={type} className="p-2 rounded border">
                          <div className="text-xs font-medium capitalize mb-1">{type}</div>
                          <div className="text-lg font-bold">
                            {(summarizeNoteMutation.data as any).data?.extractedData?.[type]?.length || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
