import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  User, 
  Pill, 
  Activity, 
  Calendar, 
  AlertTriangle,
  Heart,
  TestTube,
  Loader2,
  Info,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PatientDemographics {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  age?: number;
}

interface PatientRecordData {
  demographics: PatientDemographics;
  medications: Array<{ name: string; dosage: string; frequency: string; status: string }>;
  conditions: Array<{ name: string; status: string; onsetDate?: string }>;
  encounters: Array<{ type: string; date: string; reason?: string }>;
  allergies: Array<{ substance: string; reaction?: string; severity?: string }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string }>;
  labResults: Array<{ name: string; value: number; unit: string; abnormal?: boolean; date: string }>;
}

interface PatientSummary {
  executiveSummary: string;
  demographicsSummary: string;
  activeMedicationsSummary: string;
  activeConditionsSummary: string;
  recentEncountersSummary: string;
  allergiesSummary: string;
  vitalsTrendSummary: string;
  labResultsSummary: string;
  keyFindings: string[];
  generatedAt: string;
  disclaimer: string;
}

interface AIPatientSummaryPanelProps {
  patientId: string;
  patientData: PatientRecordData;
  showDisclaimer?: boolean;
  onGenerated?: () => void;
}

export function AIPatientSummaryPanel({ 
  patientId, 
  patientData,
  showDisclaimer = true,
  onGenerated
}: AIPatientSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [summary, setSummary] = useState<PatientSummary | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/ai-clinical/patient-summary/${patientId}`, patientData);
      return await response.json() as { success: boolean; summary: PatientSummary };
    },
    onSuccess: (data) => {
      setSummary(data.summary);
      onGenerated?.();
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  return (
    <Card data-testid="ai-patient-summary-panel">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">AI Patient Summary</CardTitle>
              <Badge variant="outline" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                Informational Only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!summary && (
                <Button 
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  size="sm"
                  data-testid="button-generate-summary"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-toggle-summary">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {showDisclaimer && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">Documentation Review Only</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                  This AI-generated summary is for documentation review purposes only and does not constitute medical advice.
                </AlertDescription>
              </Alert>
            )}

            {generateMutation.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Generation Failed</AlertTitle>
                <AlertDescription>
                  Unable to generate patient summary. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {!summary && !generateMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Generate Summary" to create an AI-powered patient record summary.</p>
              </div>
            )}

            {summary && (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Executive Summary
                  </h4>
                  <p className="text-sm" data-testid="text-executive-summary">{summary.executiveSummary}</p>
                </div>

                {/* Key Findings */}
                {summary.keyFindings.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      Key Findings for Review
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300">
                      {summary.keyFindings.map((finding, i) => (
                        <li key={i} data-testid={`text-key-finding-${i}`}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary Sections Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  <SummarySection 
                    icon={<User className="h-4 w-4" />}
                    title="Demographics"
                    content={summary.demographicsSummary}
                    testId="demographics"
                  />
                  <SummarySection 
                    icon={<Pill className="h-4 w-4" />}
                    title="Medications"
                    content={summary.activeMedicationsSummary}
                    testId="medications"
                  />
                  <SummarySection 
                    icon={<Activity className="h-4 w-4" />}
                    title="Conditions"
                    content={summary.activeConditionsSummary}
                    testId="conditions"
                  />
                  <SummarySection 
                    icon={<Calendar className="h-4 w-4" />}
                    title="Recent Encounters"
                    content={summary.recentEncountersSummary}
                    testId="encounters"
                  />
                  <SummarySection 
                    icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                    title="Allergies"
                    content={summary.allergiesSummary}
                    testId="allergies"
                  />
                  <SummarySection 
                    icon={<Heart className="h-4 w-4" />}
                    title="Vitals Trend"
                    content={summary.vitalsTrendSummary}
                    testId="vitals"
                  />
                  <SummarySection 
                    icon={<TestTube className="h-4 w-4" />}
                    title="Lab Results"
                    content={summary.labResultsSummary}
                    testId="labs"
                    className="md:col-span-2"
                  />
                </div>

                {/* Generation Info */}
                <div className="text-xs text-muted-foreground text-right">
                  Generated: {new Date(summary.generatedAt).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SummarySection({ 
  icon, 
  title, 
  content,
  testId,
  className = ""
}: { 
  icon: React.ReactNode; 
  title: string; 
  content: string;
  testId: string;
  className?: string;
}) {
  return (
    <div className={`p-3 border rounded-lg ${className}`}>
      <h5 className="font-medium text-sm mb-1 flex items-center gap-2">
        {icon}
        {title}
      </h5>
      <p className="text-sm text-muted-foreground" data-testid={`text-summary-${testId}`}>
        {content}
      </p>
    </div>
  );
}
