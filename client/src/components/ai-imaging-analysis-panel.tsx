import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ChevronDown, 
  ChevronUp, 
  Image,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Sparkles,
  FileText,
  HelpCircle,
  Calendar,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImagingStudy {
  id: string;
  modality: string;
  bodyPart: string;
  studyDate: string;
  orderingProvider?: string;
  indication?: string;
  status: string;
}

interface ImagingReport {
  studyId: string;
  reportText: string;
  findings?: string;
  impression?: string;
  radiologist?: string;
  reportDate: string;
}

interface DiagnosticFinding {
  finding: string;
  location?: string;
  significance: 'normal' | 'incidental' | 'notable' | 'critical';
  followUpMentioned?: boolean;
}

interface ImagingAnalysisResult {
  studyId: string;
  studyType: string;
  bodyPart: string;
  studyDate: string;
  summary: string;
  keyFindings: DiagnosticFinding[];
  technicalNotes: string[];
  comparisonNotes: string[];
  patientFriendlySummary: string;
  terminology: Array<{ term: string; definition: string }>;
  generatedAt: string;
  disclaimer: string;
}

interface AIImagingAnalysisPanelProps {
  study: ImagingStudy;
  report: ImagingReport;
  viewMode?: 'patient' | 'provider';
  showDisclaimer?: boolean;
  onGenerated?: () => void;
}

export function AIImagingAnalysisPanel({ 
  study, 
  report,
  viewMode = 'patient',
  showDisclaimer = true,
  onGenerated
}: AIImagingAnalysisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [analysis, setAnalysis] = useState<ImagingAnalysisResult | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/ai-clinical/imaging-analysis/${study.id}`, { study, report });
      return await response.json() as { success: boolean; analysis: ImagingAnalysisResult };
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      onGenerated?.();
    }
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'normal': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'incidental': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'notable': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case 'normal': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'incidental': return <Info className="h-4 w-4 text-blue-600" />;
      case 'notable': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card data-testid="ai-imaging-analysis-panel">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-cyan-500" />
              <CardTitle className="text-lg">AI Imaging Report Analysis</CardTitle>
              <Badge variant="outline" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                Informational Only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!analysis && (
                <Button 
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  size="sm"
                  data-testid="button-analyze-imaging"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Report
                    </>
                  )}
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-toggle-imaging">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Study Info Header */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                <span>{study.modality} - {study.bodyPart}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(study.studyDate).toLocaleDateString()}</span>
              </div>
              {study.orderingProvider && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{study.orderingProvider}</span>
                </div>
              )}
            </div>

            {showDisclaimer && (
              <Alert className="border-cyan-200 bg-cyan-50 dark:bg-cyan-950 dark:border-cyan-800">
                <Info className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <AlertTitle className="text-cyan-800 dark:text-cyan-200">Report Summary Only</AlertTitle>
                <AlertDescription className="text-cyan-700 dark:text-cyan-300 text-sm">
                  This AI summary explains documented radiologist findings and does not constitute diagnostic interpretation or medical advice.
                </AlertDescription>
              </Alert>
            )}

            {analyzeMutation.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Analysis Failed</AlertTitle>
                <AlertDescription>
                  Unable to analyze imaging report. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {!analysis && !analyzeMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Analyze Report" to get an AI-powered summary of the imaging findings.</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4">
                {/* Patient-Friendly Summary */}
                {viewMode === 'patient' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <FileText className="h-4 w-4" />
                      What This Report Says (In Plain Language)
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300" data-testid="text-patient-summary">
                      {analysis.patientFriendlySummary}
                    </p>
                  </div>
                )}

                {/* Technical Summary (Provider View) */}
                {viewMode === 'provider' && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Study Summary
                    </h4>
                    <p className="text-sm" data-testid="text-study-summary">{analysis.summary}</p>
                  </div>
                )}

                {/* Key Findings */}
                {analysis.keyFindings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Key Findings
                    </h4>
                    <div className="space-y-2">
                      {analysis.keyFindings.map((finding, i) => (
                        <div 
                          key={i} 
                          className="flex items-start gap-3 p-3 border rounded-lg"
                          data-testid={`finding-${i}`}
                        >
                          {getSignificanceIcon(finding.significance)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{finding.finding}</span>
                              <Badge className={`text-xs ${getSignificanceColor(finding.significance)}`}>
                                {finding.significance}
                              </Badge>
                              {finding.followUpMentioned && (
                                <Badge variant="outline" className="text-xs">
                                  Follow-up mentioned
                                </Badge>
                              )}
                            </div>
                            {finding.location && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Location: {finding.location}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technical & Comparison Notes (Provider View) */}
                {viewMode === 'provider' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {analysis.technicalNotes.length > 0 && (
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Technical Notes</h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {analysis.technicalNotes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.comparisonNotes.length > 0 && (
                      <div className="p-3 border rounded-lg">
                        <h5 className="font-medium text-sm mb-2">Comparison Notes</h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {analysis.comparisonNotes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Medical Terminology Explanations */}
                {analysis.terminology.length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Medical Terms Explained
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.terminology.map((item, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="secondary" 
                              className="cursor-help"
                              data-testid={`term-${i}`}
                            >
                              {item.term}
                              <HelpCircle className="h-3 w-3 ml-1" />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">{item.definition}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}

                {/* Original Report (Collapsible) */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      View Original Report
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 bg-muted/50 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {report.reportText}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Generation Info */}
                <div className="text-xs text-muted-foreground text-right">
                  Generated: {new Date(analysis.generatedAt).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
