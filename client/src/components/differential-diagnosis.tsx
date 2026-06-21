import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Microscope,
  FileText,
  Activity,
  Stethoscope,
  Clock,
  Info,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface DifferentialDiagnosis {
  condition: string;
  probability: "high" | "medium" | "low";
  supportingEvidence: string[];
  contradictingFactors: string[];
  suggestedWorkup: string[];
}

interface DifferentialDiagnosisResult {
  patientId: string;
  generatedAt: string;
  differentials: DifferentialDiagnosis[];
  clinicalContext: string;
  dataQualityNotes: string[];
  disclaimer: string;
}

const PROBABILITY_CONFIG = {
  high: { color: "text-red-500", bgColor: "bg-red-500/10", icon: AlertTriangle, label: "High" },
  medium: { color: "text-yellow-500", bgColor: "bg-yellow-500/10", icon: Activity, label: "Medium" },
  low: { color: "text-green-500", bgColor: "bg-green-500/10", icon: Info, label: "Low" },
};

function DifferentialItem({ differential, index }: { differential: DifferentialDiagnosis; index: number }) {
  const config = PROBABILITY_CONFIG[differential.probability];
  const ProbIcon = config.icon;

  return (
    <AccordionItem value={`diff-${index}`}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 w-full pr-4">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <ProbIcon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium">{differential.condition}</div>
            <div className="text-xs text-muted-foreground">
              {differential.supportingEvidence.length} supporting findings
            </div>
          </div>
          <Badge variant="outline" className={config.color}>
            {config.label} Probability
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {differential.supportingEvidence.length > 0 && (
            <div>
              <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Supporting Evidence
              </h5>
              <ul className="space-y-1 ml-6">
                {differential.supportingEvidence.map((evidence, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc">
                    {evidence}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {differential.contradictingFactors.length > 0 && (
            <div>
              <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Contradicting Factors
              </h5>
              <ul className="space-y-1 ml-6">
                {differential.contradictingFactors.map((factor, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc">
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {differential.suggestedWorkup.length > 0 && (
            <div>
              <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Microscope className="h-4 w-4 text-blue-500" />
                Suggested Workup
              </h5>
              <ul className="space-y-1 ml-6">
                {differential.suggestedWorkup.map((workup, i) => (
                  <li key={i} className="text-sm text-muted-foreground list-disc">
                    {workup}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

interface DifferentialDiagnosisCardProps {
  patientId: string;
}

export function DifferentialDiagnosisCard({ patientId }: DifferentialDiagnosisCardProps) {
  const { data, isLoading, refetch, isFetching } = useQuery<DifferentialDiagnosisResult>({
    queryKey: ["/api/differential-diagnosis", patientId],
    enabled: !!patientId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", `/api/differential-diagnosis/${patientId}`);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/differential-diagnosis", patientId] });
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-differential-diagnosis">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-differential-diagnosis">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              AI Differential Diagnosis
            </CardTitle>
            <CardDescription>
              Pre-appointment analysis for clinician review
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || isFetching}
            data-testid="button-generate-diagnosis"
          >
            {generateMutation.isPending || isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Regenerate</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!data ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              Generate AI-powered differential diagnosis based on patient data
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-initial-generate"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate Differential Diagnosis
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Clinical Context */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
                <Stethoscope className="h-4 w-4" />
                Clinical Context
              </h4>
              <p className="text-sm text-muted-foreground">{data.clinicalContext}</p>
            </div>

            {/* Data Quality Notes */}
            {data.dataQualityNotes.length > 0 && (
              <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertTitle>Data Quality Notes</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc ml-4 mt-1">
                    {data.dataQualityNotes.map((note, i) => (
                      <li key={i} className="text-sm">{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Differential List */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Differential Diagnoses ({data.differentials.length})
              </h4>
              
              <ScrollArea className="max-h-[400px]">
                <Accordion type="single" collapsible className="w-full">
                  {data.differentials.map((diff, index) => (
                    <DifferentialItem key={index} differential={diff} index={index} />
                  ))}
                </Accordion>
              </ScrollArea>
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Generated {format(new Date(data.generatedAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground text-center w-full">
          {data?.disclaimer || "Educational reference only. Not a clinical diagnosis. All differentials require clinician evaluation."}
        </p>
      </CardFooter>
    </Card>
  );
}
