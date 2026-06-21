import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Download, RefreshCw, Heart, Pill, AlertTriangle, TestTube, FileImage, FolderOpen, Calendar, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface SnapshotOutput {
  language: string;
  bilingual: boolean;
  snapshot_sections: {
    problems: string[];
    allergies: string[];
    medications: string[];
    recent_results: string[];
    documents: string[];
  };
  metadata: {
    last_updated: string;
    sources_connected: string[];
  };
  disclaimer: string;
}

const SAMPLE_SNAPSHOT = {
  problems: [
    { name: "Type 2 Diabetes Mellitus", onset_date: "2020-03-15", status: "Active", source: "Fasten Health", record_id: "prob-001" },
    { name: "Essential Hypertension", onset_date: "2019-01-10", status: "Active", source: "Fasten Health", record_id: "prob-002" },
    { name: "Hyperlipidemia", onset_date: "2021-06-20", status: "Active", source: "Fasten Health", record_id: "prob-003" }
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Rash", severity: "Moderate", source: "Fasten Health", record_id: "allergy-001" },
    { allergen: "Sulfa drugs", reaction: "Hives", severity: "Severe", source: "Fasten Health", record_id: "allergy-002" }
  ],
  meds: [
    { drug_name: "Metformin", dose: "500mg", frequency: "twice daily", status: "Active", source: "Fasten Health", record_id: "med-001" },
    { drug_name: "Lisinopril", dose: "10mg", frequency: "once daily", status: "Active", source: "Fasten Health", record_id: "med-002" },
    { drug_name: "Atorvastatin", dose: "20mg", frequency: "once daily", status: "Active", source: "Fasten Health", record_id: "med-003" }
  ],
  recent_labs: [
    { test_name: "HbA1c", value: "7.2", unit: "%", date: "2025-01-10", source: "Quest Diagnostics", record_id: "lab-001" },
    { test_name: "Lipid Panel - LDL", value: "110", unit: "mg/dL", date: "2025-01-10", source: "Quest Diagnostics", record_id: "lab-002" },
    { test_name: "Creatinine", value: "1.1", unit: "mg/dL", date: "2025-01-10", source: "Quest Diagnostics", record_id: "lab-003" }
  ],
  recent_imaging: [
    { modality: "X-Ray", body_part: "Chest", date: "2024-12-15", impression: "No acute findings", source: "RadNet", record_id: "img-001" }
  ],
  key_documents: [
    { title: "Annual Physical Summary", type: "Visit Summary", date: "2025-01-05", source: "Fasten Health", record_id: "doc-001" },
    { title: "Lab Results Report", type: "Lab Report", date: "2025-01-10", source: "Quest Diagnostics", record_id: "doc-002" }
  ],
  last_sync_date: "2025-01-19T10:30:00Z",
  sources: ["Fasten Health", "Fasten Health", "Quest Diagnostics", "RadNet"]
};

function SectionCard({ title, icon: Icon, items, emptyMessage }: { 
  title: string; 
  icon: typeof Heart; 
  items: string[]; 
  emptyMessage: string;
}) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="text-sm whitespace-pre-wrap border-b pb-2 last:border-0 last:pb-0">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function SnapshotPdf() {
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [bilingual, setBilingual] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotOutput | null>(null);

  const { data: languages } = useQuery<{ success: boolean; data: { all: Array<{ code: string; name: string }> } }>({
    queryKey: ["/api/translation/languages"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/translation/snapshot-pdf", {
        targetLanguage,
        bilingual,
        snapshot: SAMPLE_SNAPSHOT
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSnapshotResult(data.data);
      }
    }
  });

  const handleDownloadText = () => {
    if (!snapshotResult) return;

    const sections = snapshotResult.snapshot_sections;
    let content = "";
    
    content += "=== HEALTH SNAPSHOT ===\n\n";
    content += `Language: ${snapshotResult.language}${snapshotResult.bilingual ? " (Bilingual)" : ""}\n`;
    content += `Last Updated: ${snapshotResult.metadata.last_updated}\n`;
    content += `Sources: ${snapshotResult.metadata.sources_connected.join(", ")}\n\n`;

    content += "--- PROBLEMS ---\n";
    sections.problems.forEach(p => content += `• ${p}\n`);
    content += "\n";

    content += "--- ALLERGIES ---\n";
    sections.allergies.forEach(a => content += `• ${a}\n`);
    content += "\n";

    content += "--- MEDICATIONS ---\n";
    sections.medications.forEach(m => content += `• ${m}\n`);
    content += "\n";

    content += "--- RECENT RESULTS ---\n";
    sections.recent_results.forEach(r => content += `• ${r}\n`);
    content += "\n";

    content += "--- DOCUMENTS ---\n";
    sections.documents.forEach(d => content += `• ${d}\n`);
    content += "\n";

    content += "---\n";
    content += snapshotResult.disclaimer;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-snapshot-${snapshotResult.language}${snapshotResult.bilingual ? "-bilingual" : ""}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-snapshot-pdf">
          <FileText className="h-6 w-6" />
          Health Snapshot PDF
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate a concise one-page summary of your health records with optional bilingual support
        </p>
      </div>

      <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200" data-testid="text-disclaimer-banner">
            FOR INFORMATIONAL PURPOSES ONLY. This is a data snapshot, not medical advice.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Generate Snapshot</CardTitle>
              <CardDescription>Configure your health record snapshot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="language">Target Language</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger id="language" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    {languages?.data?.all?.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="bilingual">Bilingual Output</Label>
                  <p className="text-xs text-muted-foreground">
                    Show English + translated text in paired lines
                  </p>
                </div>
                <Switch
                  id="bilingual"
                  checked={bilingual}
                  onCheckedChange={setBilingual}
                  data-testid="switch-bilingual"
                />
              </div>

              <div className="p-4 bg-muted rounded-md">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Sample Data Preview
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{SAMPLE_SNAPSHOT.problems.length} problems</p>
                  <p>{SAMPLE_SNAPSHOT.allergies.length} allergies</p>
                  <p>{SAMPLE_SNAPSHOT.meds.length} medications</p>
                  <p>{SAMPLE_SNAPSHOT.recent_labs.length} lab results</p>
                  <p>{SAMPLE_SNAPSHOT.recent_imaging.length} imaging reports</p>
                  <p>{SAMPLE_SNAPSHOT.key_documents.length} documents</p>
                  <p className="text-xs mt-2">Sources: {SAMPLE_SNAPSHOT.sources.join(", ")}</p>
                </div>
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
                data-testid="button-generate-snapshot"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Snapshot
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          {snapshotResult ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>Health Snapshot</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{snapshotResult.language}</Badge>
                      {snapshotResult.bilingual && <Badge variant="outline">Bilingual</Badge>}
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleDownloadText} data-testid="button-download">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-muted rounded-md text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Last Updated:</span>
                    <span>{new Date(snapshotResult.metadata.last_updated).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Database className="h-4 w-4" />
                    <span className="font-medium">Sources:</span>
                    {snapshotResult.metadata.sources_connected.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>

                <Tabs defaultValue="problems">
                  <TabsList className="grid w-full grid-cols-5 gap-1">
                    <TabsTrigger value="problems" data-testid="tab-problems">
                      <Heart className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="allergies" data-testid="tab-allergies">
                      <AlertTriangle className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="medications" data-testid="tab-medications">
                      <Pill className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="results" data-testid="tab-results">
                      <TestTube className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="documents" data-testid="tab-documents">
                      <FolderOpen className="h-3 w-3" />
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="problems" className="mt-4">
                    <SectionCard 
                      title="Problems" 
                      icon={Heart} 
                      items={snapshotResult.snapshot_sections.problems}
                      emptyMessage="No problems recorded"
                    />
                  </TabsContent>

                  <TabsContent value="allergies" className="mt-4">
                    <SectionCard 
                      title="Allergies" 
                      icon={AlertTriangle} 
                      items={snapshotResult.snapshot_sections.allergies}
                      emptyMessage="No allergies recorded"
                    />
                  </TabsContent>

                  <TabsContent value="medications" className="mt-4">
                    <SectionCard 
                      title="Medications" 
                      icon={Pill} 
                      items={snapshotResult.snapshot_sections.medications}
                      emptyMessage="No medications recorded"
                    />
                  </TabsContent>

                  <TabsContent value="results" className="mt-4">
                    <SectionCard 
                      title="Recent Results" 
                      icon={TestTube} 
                      items={snapshotResult.snapshot_sections.recent_results}
                      emptyMessage="No recent results"
                    />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    <SectionCard 
                      title="Documents" 
                      icon={FolderOpen} 
                      items={snapshotResult.snapshot_sections.documents}
                      emptyMessage="No documents"
                    />
                  </TabsContent>
                </Tabs>

                <div className="mt-4 p-3 border-t">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap" data-testid="text-disclaimer">
                    {snapshotResult.disclaimer}
                  </p>
                </div>

                <AiSummaryFeedback
                  feedbackType="snapshot_pdf"
                  summaryId={`snapshot-${snapshotResult.metadata.last_updated}`}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Snapshot Generated</h3>
                <p className="text-sm text-muted-foreground">
                  Configure options and click "Generate Snapshot" to create your health summary
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
