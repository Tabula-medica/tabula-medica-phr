import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, HelpCircle, Plus, Trash2, Pill, FileText, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface MedicationInput {
  drug_name: string;
  dose: string;
  frequency: string;
  route: string;
  status: "taking" | "not taking" | "unsure";
  last_updated: string;
  source: string;
  record_id: string;
}

interface MedicationEntry {
  drug: string;
  dose: string;
  frequency: string;
  route?: string;
  source: string;
  record_id: string;
  last_updated?: string;
}

interface DuplicateOrConflict {
  issue: "duplicate" | "conflict";
  entries: Array<{
    drug: string;
    details: string;
    source: string;
    record_id: string;
  }>;
}

interface MedicationSummaryOutput {
  language: string;
  taking: MedicationEntry[];
  not_taking: MedicationEntry[];
  unsure: MedicationEntry[];
  duplicates_or_conflicts: DuplicateOrConflict[];
  limitations: string[];
  disclaimer: string;
}

const SAMPLE_MEDICATIONS: MedicationInput[] = [
  {
    drug_name: "Metformin",
    dose: "500mg",
    frequency: "twice daily",
    route: "oral",
    status: "taking",
    last_updated: "2025-01-15",
    source: "Fasten Health",
    record_id: "med-001"
  },
  {
    drug_name: "Lisinopril",
    dose: "10mg",
    frequency: "once daily",
    route: "oral",
    status: "taking",
    last_updated: "2025-01-10",
    source: "Fasten Health",
    record_id: "med-002"
  },
  {
    drug_name: "Metformin",
    dose: "1000mg",
    frequency: "once daily",
    route: "oral",
    status: "taking",
    last_updated: "2025-01-12",
    source: "Fasten Health",
    record_id: "med-003"
  },
  {
    drug_name: "Aspirin",
    dose: "81mg",
    frequency: "once daily",
    route: "oral",
    status: "not taking",
    last_updated: "2024-12-01",
    source: "Fasten Health",
    record_id: "med-004"
  },
  {
    drug_name: "Atorvastatin",
    dose: "20mg",
    frequency: "once daily",
    route: "oral",
    status: "unsure",
    last_updated: "2024-11-15",
    source: "Fasten Health",
    record_id: "med-005"
  }
];

function MedicationCard({ med, category }: { med: MedicationEntry; category: string }) {
  const statusIcons = {
    taking: <Check className="h-4 w-4 text-green-500" />,
    not_taking: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    unsure: <HelpCircle className="h-4 w-4 text-blue-500" />
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {statusIcons[category as keyof typeof statusIcons]}
            <div>
              <h4 className="font-semibold" data-testid={`text-drug-name-${med.record_id}`}>{med.drug}</h4>
              <p className="text-sm text-muted-foreground" data-testid={`text-drug-details-${med.record_id}`}>
                {med.dose} - {med.frequency} {med.route ? `(${med.route})` : ""}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p data-testid={`text-drug-source-${med.record_id}`}>Source: {med.source}</p>
            <p data-testid={`text-drug-record-id-${med.record_id}`}>ID: {med.record_id}</p>
            {med.last_updated && <p>Updated: {med.last_updated}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConflictCard({ conflict }: { conflict: DuplicateOrConflict }) {
  const isConflict = conflict.issue === "conflict";

  return (
    <Card className={`mb-3 ${isConflict ? "border-destructive" : "border-yellow-500"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={isConflict ? "destructive" : "secondary"} data-testid={`badge-issue-type-${conflict.entries[0]?.drug}`}>
            {isConflict ? "Conflict" : "Duplicate"}
          </Badge>
          <CardTitle className="text-base">{conflict.entries[0]?.drug}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {conflict.entries.map((entry, idx) => (
            <div key={idx} className="text-sm p-2 bg-muted rounded">
              <p><strong>Details:</strong> {entry.details}</p>
              <p className="text-muted-foreground">Source: {entry.source} | ID: {entry.record_id}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MedicationSummary() {
  const [medications, setMedications] = useState<MedicationInput[]>(SAMPLE_MEDICATIONS);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [summaryResult, setSummaryResult] = useState<MedicationSummaryOutput | null>(null);

  const [newMed, setNewMed] = useState<MedicationInput>({
    drug_name: "",
    dose: "",
    frequency: "",
    route: "oral",
    status: "taking",
    last_updated: new Date().toISOString().split("T")[0],
    source: "",
    record_id: ""
  });

  const { data: languages } = useQuery<{ success: boolean; data: { all: Array<{ code: string; name: string }> } }>({
    queryKey: ["/api/translation/languages"],
  });

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/translation/medication-summary", {
        targetLanguage,
        medications
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSummaryResult(data.data);
      }
    }
  });

  const handleAddMedication = () => {
    if (!newMed.drug_name || !newMed.dose || !newMed.source || !newMed.record_id) return;
    setMedications([...medications, { ...newMed }]);
    setNewMed({
      drug_name: "",
      dose: "",
      frequency: "",
      route: "oral",
      status: "taking",
      last_updated: new Date().toISOString().split("T")[0],
      source: "",
      record_id: ""
    });
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-medication-summary">
          <Pill className="h-6 w-6" />
          Medication List Summary
        </h1>
        <p className="text-muted-foreground mt-1">
          Summarize and organize your medication list with duplicate/conflict detection
        </p>
      </div>

      <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200" data-testid="text-disclaimer-banner">
            FOR INFORMATIONAL PURPOSES ONLY. This is a data summary, not medical advice. 
            Drug names and dosages are displayed exactly as recorded in your health records.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Input Medications
              </CardTitle>
              <CardDescription>Add or modify your medication list</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4 p-4 border rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="drug_name">Drug Name *</Label>
                    <Input
                      id="drug_name"
                      value={newMed.drug_name}
                      onChange={(e) => setNewMed({ ...newMed, drug_name: e.target.value })}
                      placeholder="e.g., Metformin"
                      data-testid="input-drug-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dose">Dose *</Label>
                    <Input
                      id="dose"
                      value={newMed.dose}
                      onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })}
                      placeholder="e.g., 500mg"
                      data-testid="input-dose"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Input
                      id="frequency"
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                      placeholder="e.g., twice daily"
                      data-testid="input-frequency"
                    />
                  </div>
                  <div>
                    <Label htmlFor="route">Route</Label>
                    <Input
                      id="route"
                      value={newMed.route}
                      onChange={(e) => setNewMed({ ...newMed, route: e.target.value })}
                      placeholder="e.g., oral"
                      data-testid="input-route"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="source">Source *</Label>
                    <Input
                      id="source"
                      value={newMed.source}
                      onChange={(e) => setNewMed({ ...newMed, source: e.target.value })}
                      placeholder="e.g., Fasten Health"
                      data-testid="input-source"
                    />
                  </div>
                  <div>
                    <Label htmlFor="record_id">Record ID *</Label>
                    <Input
                      id="record_id"
                      value={newMed.record_id}
                      onChange={(e) => setNewMed({ ...newMed, record_id: e.target.value })}
                      placeholder="e.g., med-001"
                      data-testid="input-record-id"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newMed.status}
                    onValueChange={(v) => setNewMed({ ...newMed, status: v as MedicationInput["status"] })}
                  >
                    <SelectTrigger id="status" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taking">Taking</SelectItem>
                      <SelectItem value="not taking">Not Taking</SelectItem>
                      <SelectItem value="unsure">Unsure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddMedication} className="w-full" data-testid="button-add-medication">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {medications.map((med, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{med.drug_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {med.dose} - {med.status} | {med.source}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveMedication(idx)}
                      data-testid={`button-remove-medication-${idx}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Generate Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="language">Target Language</Label>
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger id="language" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages?.data?.all?.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      )) || <SelectItem value="en">English</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => summarizeMutation.mutate()}
                  disabled={summarizeMutation.isPending || medications.length === 0}
                  className="w-full"
                  data-testid="button-generate-summary"
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {summaryResult ? (
            <Card>
              <CardHeader>
                <CardTitle>Medication Summary</CardTitle>
                <CardDescription>
                  Language: {summaryResult.language}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="taking">
                  <TabsList className="grid w-full grid-cols-4 gap-1">
                    <TabsTrigger value="taking" data-testid="tab-taking">
                      Taking ({summaryResult.taking.length})
                    </TabsTrigger>
                    <TabsTrigger value="not_taking" data-testid="tab-not-taking">
                      Not Taking ({summaryResult.not_taking.length})
                    </TabsTrigger>
                    <TabsTrigger value="unsure" data-testid="tab-unsure">
                      Unsure ({summaryResult.unsure.length})
                    </TabsTrigger>
                    <TabsTrigger value="issues" data-testid="tab-issues">
                      Issues ({summaryResult.duplicates_or_conflicts.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="taking" className="mt-4">
                    {summaryResult.taking.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No medications in this category</p>
                    ) : (
                      summaryResult.taking.map((med) => (
                        <MedicationCard key={med.record_id} med={med} category="taking" />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="not_taking" className="mt-4">
                    {summaryResult.not_taking.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No medications in this category</p>
                    ) : (
                      summaryResult.not_taking.map((med) => (
                        <MedicationCard key={med.record_id} med={med} category="not_taking" />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="unsure" className="mt-4">
                    {summaryResult.unsure.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No medications in this category</p>
                    ) : (
                      summaryResult.unsure.map((med) => (
                        <MedicationCard key={med.record_id} med={med} category="unsure" />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="issues" className="mt-4">
                    {summaryResult.duplicates_or_conflicts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No duplicates or conflicts detected</p>
                    ) : (
                      summaryResult.duplicates_or_conflicts.map((conflict, idx) => (
                        <ConflictCard key={idx} conflict={conflict} />
                      ))
                    )}
                  </TabsContent>
                </Tabs>

                {summaryResult.limitations.length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <h4 className="font-medium mb-2">Limitations</h4>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {summaryResult.limitations.map((lim, idx) => (
                        <li key={idx}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 p-3 border-t">
                  <p className="text-xs text-muted-foreground" data-testid="text-disclaimer">
                    {summaryResult.disclaimer}
                  </p>
                </div>

                <AiSummaryFeedback
                  feedbackType="medication_summary"
                  summaryId={`meds-${summaryResult.taking[0]?.record_id || Date.now()}`}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Summary Generated</h3>
                <p className="text-sm text-muted-foreground">
                  Add medications and click "Generate Summary" to see your organized medication list
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-medication-summary-disclaimer" />
    </div>
  );
}