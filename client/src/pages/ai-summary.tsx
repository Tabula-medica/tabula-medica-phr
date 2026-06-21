import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Brain, 
  Sparkles,
  User,
  FileText,
  Loader2,
  RefreshCw,
  Shield
} from "lucide-react";
import { ExplainInsightModal, parseInsightSources } from "@/components/explain-insight-modal";
import { InsightWorkflowActions } from "@/components/insight-workflow-actions";
import type { Patient } from "@shared/schema";
import { PageGate } from "@/components/page-gate";

interface HealthSummary {
  patientId: string;
  patientName: string;
  summary: string;
  generatedAt: string;
}

function PatientSelector({ 
  patients, 
  selectedId, 
  onSelect 
}: { 
  patients: Patient[]; 
  selectedId: string | null; 
  onSelect: (id: string) => void;
}) {
  return (
    <Select value={selectedId || ""} onValueChange={onSelect}>
      <SelectTrigger className="w-full" data-testid="select-patient">
        <SelectValue placeholder="Select a patient" />
      </SelectTrigger>
      <SelectContent>
        {patients.map((patient) => (
          <SelectItem key={patient.id} value={patient.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {patient.firstName[0]}{patient.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {patient.firstName} {patient.lastName}
              <span className="text-muted-foreground text-xs">MRN: {patient.mrn}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SummaryCard({ summary }: { summary: HealthSummary }) {
  const parsedSources = parseInsightSources(summary.summary);
  
  return (
    <Card data-testid={`card-summary-${summary.patientId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {summary.patientName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <InsightWorkflowActions
              patientId={summary.patientId}
              patientName={summary.patientName}
              insight={summary.summary}
              sourceData={parsedSources[0]}
              compact
            />
            <ExplainInsightModal
              insight={summary.summary.slice(0, 200) + "..."}
              dataSources={parsedSources}
              compact
            />
            <span className="text-xs text-muted-foreground">
              {new Date(summary.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-sm">{summary.summary}</p>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
          <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            This AI-generated summary is for informational purposes only and does not 
            constitute medical advice. Always consult with your healthcare provider.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AISummary() {
  useSEO({
    title: "AI Health Summary",
    description: "Generate AI-powered health summaries for your patients using advanced language models"
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSummary, setCurrentSummary] = useState("");

  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);

  const generateSummary = async () => {
    if (!selectedPatientId || !selectedPatient) return;
    
    setIsGenerating(true);
    setCurrentSummary("");
    
    try {
      const response = await fetch(`/api/patients/${selectedPatientId}/ai-summary`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to generate summary');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let fullSummary = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullSummary += data.content;
                setCurrentSummary(fullSummary);
              }
              if (data.done) {
                const newSummary: HealthSummary = {
                  patientId: selectedPatientId,
                  patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                  summary: fullSummary,
                  generatedAt: new Date().toISOString(),
                };
                setSummaries(prev => [newSummary, ...prev]);
                setCurrentSummary("");
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAllSummaries = async () => {
    if (!patients?.length) return;
    
    setIsGenerating(true);
    
    for (const patient of patients.slice(0, 5)) { // Limit to first 5 patients
      setSelectedPatientId(patient.id);
      setCurrentSummary("");
      
      try {
        const response = await fetch(`/api/patients/${patient.id}/ai-summary`, {
          method: 'POST',
        });
        
        if (!response.ok) continue;
        
        const reader = response.body?.getReader();
        if (!reader) continue;
        
        const decoder = new TextDecoder();
        let fullSummary = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullSummary += data.content;
                  setCurrentSummary(fullSummary);
                }
              } catch {}
            }
          }
        }
        
        if (fullSummary) {
          const newSummary: HealthSummary = {
            patientId: patient.id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            summary: fullSummary,
            generatedAt: new Date().toISOString(),
          };
          setSummaries(prev => [newSummary, ...prev.filter(s => s.patientId !== patient.id)]);
        }
      } catch (error) {
        console.error('Error generating summary for patient:', patient.id, error);
      }
    }
    
    setCurrentSummary("");
    setIsGenerating(false);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <PageGate feature="ai_summaries" />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Health Summary
            </h1>
            <p className="text-muted-foreground">
              Generate AI-powered summaries of patient health data from all connected EHRs
            </p>
          </div>
        </div>

        {/* Summary Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate Summary
            </CardTitle>
            <CardDescription>
              Select a patient to generate an AI-powered health summary aggregating data from all EHR sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                {patientsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : patients?.length ? (
                  <PatientSelector
                    patients={patients}
                    selectedId={selectedPatientId}
                    onSelect={setSelectedPatientId}
                  />
                ) : (
                  <div className="h-10 flex items-center text-sm text-muted-foreground">
                    No patients available. Connect an EHR first.
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={generateSummary}
                  disabled={!selectedPatientId || isGenerating}
                  data-testid="button-generate-summary"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={generateAllSummaries}
                  disabled={!patients?.length || isGenerating}
                  data-testid="button-generate-all"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate All
                </Button>
              </div>
            </div>

            {/* Current Generation Preview */}
            {currentSummary && (
              <div className="p-4 rounded-md bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    Generating summary for {selectedPatient?.firstName} {selectedPatient?.lastName}...
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{currentSummary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Summaries */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generated Summaries
          </h2>
          
          {summaries.length ? (
            <div className="space-y-4">
              {summaries.map((summary, index) => (
                <SummaryCard key={`${summary.patientId}-${index}`} summary={summary} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-1">No summaries yet</h3>
                <p className="text-sm text-muted-foreground">
                  Select a patient and click "Generate" to create an AI health summary
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
