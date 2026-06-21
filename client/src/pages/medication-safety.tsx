import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Shield,
  Pill,
  Activity,
  Target,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Lightbulb,
  ShieldAlert,
  HeartPulse,
  FileWarning,
  Stethoscope,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Patient } from "@shared/schema";
import { PageHeader, MetricCard } from "@/components/shared";

type InteractionSeverity = "contraindicated" | "serious" | "moderate" | "minor";
type InterventionUrgency = "immediate" | "urgent" | "soon" | "routine";

interface DrugInteraction {
  id: string;
  medication1: { id: string; name: string; dosage: string };
  medication2: { id: string; name: string; dosage: string };
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendation: string;
  alternativeOptions?: string[];
  monitoringRequired?: string[];
  aiConfidence: number;
  detectedAt: string;
}

interface AdherenceIssue {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  issueType: "non_adherence" | "side_effects" | "cost_barrier" | "complexity" | "forgetfulness" | "perceived_inefficacy";
  severity: "mild" | "moderate" | "severe";
  description: string;
  evidencePoints: string[];
  likelyRootCause: string;
  impactOnOutcomes: string;
  suggestedInterventions: string[];
  aiConfidence: number;
  detectedAt: string;
}

interface MedicationRisk {
  id: string;
  riskType: "interaction" | "adherence" | "contraindication" | "dosing" | "side_effect" | "therapeutic_duplication";
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  description: string;
  affectedMedications: { id: string; name: string }[];
  patientFactors: string[];
  aiConfidence: number;
}

interface InterventionStrategy {
  id: string;
  targetRiskId: string;
  urgency: InterventionUrgency;
  strategyType: "medication_change" | "dosage_adjustment" | "monitoring" | "patient_education" | "adherence_support" | "alternative_therapy" | "specialist_referral";
  title: string;
  description: string;
  steps: { order: number; action: string; responsible: "provider" | "pharmacist" | "patient" | "care_team"; timeframe: string }[];
  expectedOutcome: string;
  evidenceLevel: "strong" | "moderate" | "limited";
  contraindications?: string[];
  aiConfidence: number;
}

interface MedicationSafetyAnalysis {
  patientId: string;
  patientName: string;
  analyzedAt: string;
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  activeMedicationsCount: number;
  interactions: DrugInteraction[];
  adherenceIssues: AdherenceIssue[];
  medicationRisks: MedicationRisk[];
  interventionStrategies: InterventionStrategy[];
  summary: string;
  prioritizedActions: string[];
  aiConfidence: number;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "contraindicated":
    case "critical":
      return "bg-red-500 text-white";
    case "serious":
    case "high":
    case "severe":
      return "bg-red-500/80 text-white";
    case "moderate":
      return "bg-orange-500 text-white";
    case "minor":
    case "low":
    case "mild":
      return "bg-yellow-500 text-black";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getUrgencyColor(urgency: InterventionUrgency): string {
  switch (urgency) {
    case "immediate":
      return "bg-red-500 text-white";
    case "urgent":
      return "bg-orange-500 text-white";
    case "soon":
      return "bg-yellow-500 text-black";
    case "routine":
      return "bg-green-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getRiskLevelColor(level: string): string {
  switch (level) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "high":
      return "text-orange-600 dark:text-orange-400";
    case "moderate":
      return "text-yellow-600 dark:text-yellow-400";
    case "low":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-muted-foreground";
  }
}

function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    non_adherence: "Non-Adherence",
    side_effects: "Side Effects",
    cost_barrier: "Cost Barrier",
    complexity: "Complex Regimen",
    forgetfulness: "Forgetfulness",
    perceived_inefficacy: "Perceived Inefficacy",
  };
  return labels[type] || type;
}

function getStrategyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    medication_change: "Medication Change",
    dosage_adjustment: "Dosage Adjustment",
    monitoring: "Enhanced Monitoring",
    patient_education: "Patient Education",
    adherence_support: "Adherence Support",
    alternative_therapy: "Alternative Therapy",
    specialist_referral: "Specialist Referral",
  };
  return labels[type] || type;
}

function RiskScoreGauge({ score, level }: { score: number; level: string }) {
  const getGaugeColor = () => {
    if (score >= 75) return "bg-red-500";
    if (score >= 50) return "bg-orange-500";
    if (score >= 25) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex flex-col items-center gap-2" data-testid="risk-score-gauge">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/20" />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${score * 2.51} 251`}
            strokeLinecap="round"
            className={`${getGaugeColor().replace("bg-", "text-")} transition-all duration-500`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getRiskLevelColor(level)}`} data-testid="risk-score-value">{score}</span>
          <span className="text-xs text-muted-foreground" data-testid="label-risk-score">Risk Score</span>
        </div>
      </div>
      <Badge className={getSeverityColor(level)} data-testid="risk-level-badge">{level.toUpperCase()}</Badge>
    </div>
  );
}

function InteractionCard({ interaction }: { interaction: DrugInteraction }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="bg-red-500/5 border-red-500/20" data-testid={`interaction-${interaction.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" data-testid={`interaction-med1-${interaction.id}`}>{interaction.medication1.name}</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <Badge variant="outline" data-testid={`interaction-med2-${interaction.id}`}>{interaction.medication2.name}</Badge>
          </div>
          <Badge className={getSeverityColor(interaction.severity)} data-testid={`interaction-severity-${interaction.id}`}>
            {interaction.severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-1" data-testid={`label-mechanism-${interaction.id}`}>Mechanism</h4>
          <p className="text-sm text-muted-foreground" data-testid={`text-mechanism-${interaction.id}`}>{interaction.mechanism}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-1" data-testid={`label-effects-${interaction.id}`}>Clinical Effects</h4>
          <div className="flex flex-wrap gap-1">
            {interaction.clinicalEffects.map((effect, i) => (
              <Badge key={i} variant="secondary" className="text-xs" data-testid={`effect-${interaction.id}-${i}`}>
                {effect}
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-3 bg-yellow-500/10 rounded-md">
          <h4 className="text-sm font-medium mb-1 flex items-center gap-1" data-testid={`label-recommendation-${interaction.id}`}>
            <Lightbulb className="h-4 w-4 text-yellow-600" />
            Recommendation
          </h4>
          <p className="text-sm" data-testid={`text-recommendation-${interaction.id}`}>{interaction.recommendation}</p>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full" data-testid={`button-details-${interaction.id}`}>
              {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isOpen ? "Hide Details" : "View Details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3" data-testid={`details-content-${interaction.id}`}>
            {interaction.riskFactors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1" data-testid={`label-risk-factors-${interaction.id}`}>Risk Factors</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-risk-factors-${interaction.id}`}>
                  {interaction.riskFactors.map((factor, i) => (
                    <li key={i} data-testid={`risk-factor-${interaction.id}-${i}`}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            {interaction.alternativeOptions && interaction.alternativeOptions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1" data-testid={`label-alternatives-${interaction.id}`}>Alternative Options</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-alternatives-${interaction.id}`}>
                  {interaction.alternativeOptions.map((alt, i) => (
                    <li key={i} data-testid={`alternative-${interaction.id}-${i}`}>{alt}</li>
                  ))}
                </ul>
              </div>
            )}

            {interaction.monitoringRequired && interaction.monitoringRequired.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1" data-testid={`label-monitoring-${interaction.id}`}>Monitoring Required</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-monitoring-${interaction.id}`}>
                  {interaction.monitoringRequired.map((item, i) => (
                    <li key={i} data-testid={`monitoring-${interaction.id}-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="h-3 w-3" />
              <span data-testid={`text-confidence-${interaction.id}`}>AI Confidence: {interaction.aiConfidence}%</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function AdherenceIssueCard({ issue }: { issue: AdherenceIssue }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="bg-orange-500/5 border-orange-500/20" data-testid={`adherence-issue-${issue.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base" data-testid={`adherence-med-name-${issue.id}`}>{issue.medicationName}</CardTitle>
            <CardDescription data-testid={`adherence-issue-type-${issue.id}`}>{getIssueTypeLabel(issue.issueType)}</CardDescription>
          </div>
          <Badge className={getSeverityColor(issue.severity)} data-testid={`adherence-severity-${issue.id}`}>
            {issue.severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm" data-testid={`adherence-description-${issue.id}`}>{issue.description}</p>

        <div className="p-3 bg-background/50 rounded-md">
          <h4 className="text-sm font-medium mb-1" data-testid={`label-root-cause-${issue.id}`}>Likely Root Cause</h4>
          <p className="text-sm text-muted-foreground" data-testid={`text-root-cause-${issue.id}`}>{issue.likelyRootCause}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-1" data-testid={`label-impact-${issue.id}`}>Impact on Outcomes</h4>
          <p className="text-sm text-muted-foreground" data-testid={`text-impact-${issue.id}`}>{issue.impactOnOutcomes}</p>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full" data-testid={`button-issue-details-${issue.id}`}>
              {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isOpen ? "Hide Details" : "View Details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3" data-testid={`issue-details-content-${issue.id}`}>
            <div>
              <h4 className="text-sm font-medium mb-1" data-testid={`label-evidence-${issue.id}`}>Evidence Points</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-evidence-${issue.id}`}>
                {issue.evidencePoints.map((point, i) => (
                  <li key={i} data-testid={`evidence-${issue.id}-${i}`}>{point}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1" data-testid={`label-interventions-${issue.id}`}>Suggested Interventions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-interventions-${issue.id}`}>
                {issue.suggestedInterventions.map((intervention, i) => (
                  <li key={i} data-testid={`intervention-${issue.id}-${i}`}>{intervention}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Brain className="h-3 w-3" />
              <span data-testid={`text-issue-confidence-${issue.id}`}>AI Confidence: {issue.aiConfidence}%</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function InterventionCard({ strategy }: { strategy: InterventionStrategy }) {
  const [isOpen, setIsOpen] = useState(false);

  const getResponsibleIcon = (responsible: string) => {
    switch (responsible) {
      case "provider":
        return <Stethoscope className="h-4 w-4" />;
      case "pharmacist":
        return <Pill className="h-4 w-4" />;
      case "patient":
        return <Users className="h-4 w-4" />;
      case "care_team":
        return <Activity className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-green-500/5 border-green-500/20" data-testid={`intervention-${strategy.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base" data-testid={`intervention-title-${strategy.id}`}>{strategy.title}</CardTitle>
            <CardDescription data-testid={`intervention-type-${strategy.id}`}>{getStrategyTypeLabel(strategy.strategyType)}</CardDescription>
          </div>
          <Badge className={getUrgencyColor(strategy.urgency)} data-testid={`intervention-urgency-${strategy.id}`}>
            {strategy.urgency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm" data-testid={`intervention-description-${strategy.id}`}>{strategy.description}</p>

        <div>
          <h4 className="text-sm font-medium mb-2" data-testid={`label-steps-${strategy.id}`}>Action Steps</h4>
          <div className="space-y-2" data-testid={`list-steps-${strategy.id}`}>
            {strategy.steps.map((step) => (
              <div key={step.order} className="flex items-start gap-3 p-2 bg-background/50 rounded-md" data-testid={`step-${strategy.id}-${step.order}`}>
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
                  {step.order}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" data-testid={`step-action-${strategy.id}-${step.order}`}>{step.action}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {getResponsibleIcon(step.responsible)}
                    <span className="capitalize" data-testid={`step-responsible-${strategy.id}-${step.order}`}>{step.responsible.replace("_", " ")}</span>
                    <span className="mx-1">·</span>
                    <Clock className="h-3 w-3" />
                    <span data-testid={`step-timeframe-${strategy.id}-${step.order}`}>{step.timeframe}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full" data-testid={`button-strategy-details-${strategy.id}`}>
              {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isOpen ? "Hide Details" : "View Details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3" data-testid={`strategy-details-content-${strategy.id}`}>
            <div className="p-3 bg-green-500/10 rounded-md">
              <h4 className="text-sm font-medium mb-1" data-testid={`label-outcome-${strategy.id}`}>Expected Outcome</h4>
              <p className="text-sm" data-testid={`text-outcome-${strategy.id}`}>{strategy.expectedOutcome}</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span data-testid={`text-evidence-level-${strategy.id}`}>Evidence: {strategy.evidenceLevel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                <span data-testid={`text-strategy-confidence-${strategy.id}`}>AI Confidence: {strategy.aiConfidence}%</span>
              </div>
            </div>

            {strategy.contraindications && strategy.contraindications.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1 text-red-600 dark:text-red-400" data-testid={`label-contraindications-${strategy.id}`}>
                  Contraindications
                </h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid={`list-contraindications-${strategy.id}`}>
                  {strategy.contraindications.map((item, i) => (
                    <li key={i} data-testid={`contraindication-${strategy.id}-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function MedicationRiskCard({ risk }: { risk: MedicationRisk }) {
  return (
    <Card className="hover-elevate" data-testid={`medication-risk-${risk.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base" data-testid={`risk-title-${risk.id}`}>{risk.title}</CardTitle>
          <Badge className={getSeverityColor(risk.severity)} data-testid={`risk-severity-${risk.id}`}>
            {risk.severity}
          </Badge>
        </div>
        <CardDescription className="capitalize" data-testid={`risk-type-${risk.id}`}>
          {risk.riskType.replace("_", " ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid={`risk-description-${risk.id}`}>{risk.description}</p>

        <div>
          <h4 className="text-xs font-medium mb-1 text-muted-foreground" data-testid={`label-affected-meds-${risk.id}`}>Affected Medications</h4>
          <div className="flex flex-wrap gap-1" data-testid={`list-affected-meds-${risk.id}`}>
            {risk.affectedMedications.map((med, i) => (
              <Badge key={i} variant="outline" className="text-xs" data-testid={`affected-med-${risk.id}-${i}`}>
                {med.name}
              </Badge>
            ))}
          </div>
        </div>

        {risk.patientFactors.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-1 text-muted-foreground" data-testid={`label-patient-factors-${risk.id}`}>Patient Factors</h4>
            <div className="flex flex-wrap gap-1" data-testid={`list-patient-factors-${risk.id}`}>
              {risk.patientFactors.map((factor, i) => (
                <Badge key={i} variant="secondary" className="text-xs" data-testid={`patient-factor-${risk.id}-${i}`}>
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Brain className="h-3 w-3" />
          <span data-testid={`text-risk-confidence-${risk.id}`}>AI Confidence: {risk.aiConfidence}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48 md:col-span-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function MedicationSafety() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisError,
    refetch,
    isFetching,
  } = useQuery<MedicationSafetyAnalysis>({
    queryKey: ["/api/provider/portal/medication-safety", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const handleRefresh = async () => {
    if (!selectedPatientId) return;
    try {
      await apiRequest("GET", `/api/provider/portal/medication-safety/${selectedPatientId}?forceRefresh=true`);
      await queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/medication-safety", selectedPatientId] });
      toast({
        title: "Analysis refreshed",
        description: "Medication safety analysis has been updated.",
      });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Could not refresh the analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl" data-testid="medication-safety-page">
      <div className="mb-6">
        <PageHeader
          title="Medication Safety Analysis"
          subtitle="AI-powered detection of drug interactions, adherence issues, and intervention strategies"
          icon={<ShieldAlert className="h-6 w-6 text-primary" />}
          data-testid="page-title"
          actions={
            <div className="flex items-center gap-3">
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="w-[240px]" data-testid="select-trigger-patient">
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patientsLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    patients?.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id} data-testid={`select-patient-${patient.id}`}>
                        {patient.firstName} {patient.lastName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={!selectedPatientId || isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </div>

      {!selectedPatientId ? (
        <Card className="p-12 text-center" data-testid="empty-state-no-patient">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" data-testid="empty-title">Select a Patient</h2>
              <p className="text-muted-foreground mt-1" data-testid="empty-description">
                Choose a patient to view their medication safety analysis
              </p>
            </div>
          </div>
        </Card>
      ) : analysisLoading ? (
        <LoadingSkeleton />
      ) : analysisError ? (
        <Card className="p-12 text-center" data-testid="error-state-analysis">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-destructive/10 rounded-full">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" data-testid="error-title">Failed to Load Analysis</h2>
              <p className="text-muted-foreground mt-1" data-testid="error-description">
                There was an error loading the medication safety analysis. Please try again.
              </p>
            </div>
            <Button onClick={() => refetch()} data-testid="button-retry-error">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </Card>
      ) : analysis ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10" data-testid="card-risk-overview">
              <CardContent className="pt-6">
                <RiskScoreGauge score={analysis.riskScore} level={analysis.overallRiskLevel} />
              </CardContent>
            </Card>

            <Card className="md:col-span-3" data-testid="card-summary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2" data-testid="title-ai-summary">
                    <Brain className="h-5 w-5 text-violet-600" />
                    AI Analysis Summary
                  </CardTitle>
                  <Badge variant="outline" className="text-xs" data-testid="badge-ai-confidence">
                    {analysis.aiConfidence}% confidence
                  </Badge>
                </div>
                <CardDescription data-testid="text-analyzed-time">
                  Analyzed {formatDistanceToNow(new Date(analysis.analyzedAt))} ago
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm" data-testid="text-summary">{analysis.summary}</p>

                {analysis.prioritizedActions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2" data-testid="heading-priority-actions">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Priority Actions
                    </h4>
                    <ol className="space-y-2" data-testid="list-priority-actions">
                      {analysis.prioritizedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" data-testid={`priority-action-${i}`}>
                          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                            {i + 1}
                          </span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Active Medications"
              value={analysis.activeMedicationsCount}
              icon={Pill}
              color="text-blue-500"
              testId="stats-medications"
            />
            <MetricCard
              label="Interactions"
              value={analysis.interactions.length}
              icon={AlertTriangle}
              color="text-red-500"
              testId="stats-interactions"
              description={`${analysis.interactions.filter((i) => i.severity === "serious" || i.severity === "contraindicated").length} serious`}
            />
            <MetricCard
              label="Adherence Issues"
              value={analysis.adherenceIssues.length}
              icon={HeartPulse}
              color="text-orange-500"
              testId="stats-adherence-issues"
              description={`${analysis.adherenceIssues.filter((a) => a.severity === "severe").length} severe`}
            />
            <MetricCard
              label="Interventions"
              value={analysis.interventionStrategies.length}
              icon={Target}
              color="text-green-500"
              testId="stats-interventions"
              description={`${analysis.interventionStrategies.filter((s) => s.urgency === "immediate" || s.urgency === "urgent").length} urgent`}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="interactions" data-testid="tab-interactions">
                Interactions {analysis.interactions.length > 0 && <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">{analysis.interactions.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="adherence" data-testid="tab-adherence">
                Adherence {analysis.adherenceIssues.length > 0 && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">{analysis.adherenceIssues.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
              <TabsTrigger value="interventions" data-testid="tab-interventions">Interventions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6" data-testid="tab-content-overview">
              {analysis.interactions.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2" data-testid="heading-top-interactions">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Top Drug Interactions
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {analysis.interactions.slice(0, 2).map((interaction) => (
                      <InteractionCard key={interaction.id} interaction={interaction} />
                    ))}
                  </div>
                </div>
              )}

              {analysis.adherenceIssues.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2" data-testid="heading-top-adherence">
                    <HeartPulse className="h-5 w-5 text-orange-500" />
                    Key Adherence Issues
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {analysis.adherenceIssues.slice(0, 2).map((issue) => (
                      <AdherenceIssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                </div>
              )}

              {analysis.interventionStrategies.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2" data-testid="heading-recommended-interventions">
                    <Target className="h-5 w-5 text-green-500" />
                    Recommended Interventions
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {analysis.interventionStrategies.slice(0, 2).map((strategy) => (
                      <InterventionCard key={strategy.id} strategy={strategy} />
                    ))}
                  </div>
                </div>
              )}

              {analysis.interactions.length === 0 && analysis.adherenceIssues.length === 0 && (
                <Card className="p-8 text-center" data-testid="empty-state-no-issues">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-green-500/10 rounded-full">
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" data-testid="empty-no-issues-title">No Critical Issues Found</h2>
                      <p className="text-muted-foreground mt-1" data-testid="empty-no-issues-description">
                        The AI analysis did not detect any significant medication safety concerns.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="interactions" data-testid="tab-content-interactions">
              {analysis.interactions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.interactions.map((interaction) => (
                    <InteractionCard key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center" data-testid="empty-state-no-interactions">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-green-500/10 rounded-full">
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" data-testid="empty-interactions-title">No Drug Interactions Detected</h2>
                      <p className="text-muted-foreground mt-1" data-testid="empty-interactions-description">
                        The current medication regimen appears to be free of significant interactions.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="adherence" data-testid="tab-content-adherence">
              {analysis.adherenceIssues.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.adherenceIssues.map((issue) => (
                    <AdherenceIssueCard key={issue.id} issue={issue} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center" data-testid="empty-state-no-adherence-issues">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-green-500/10 rounded-full">
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" data-testid="empty-adherence-title">Good Medication Adherence</h2>
                      <p className="text-muted-foreground mt-1" data-testid="empty-adherence-description">
                        No significant adherence issues have been identified for this patient.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="risks" data-testid="tab-content-risks">
              {analysis.medicationRisks.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {analysis.medicationRisks.map((risk) => (
                    <MedicationRiskCard key={risk.id} risk={risk} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center" data-testid="empty-state-no-risks">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-green-500/10 rounded-full">
                      <Shield className="h-12 w-12 text-green-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" data-testid="empty-risks-title">Low Medication Risk</h2>
                      <p className="text-muted-foreground mt-1" data-testid="empty-risks-description">
                        No additional medication risks have been identified beyond the analyzed interactions.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="interventions" data-testid="tab-content-interventions">
              {analysis.interventionStrategies.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {analysis.interventionStrategies.map((strategy) => (
                    <InterventionCard key={strategy.id} strategy={strategy} />
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center" data-testid="empty-state-no-interventions">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-muted rounded-full">
                      <Target className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold" data-testid="empty-interventions-title">No Interventions Needed</h2>
                      <p className="text-muted-foreground mt-1" data-testid="empty-interventions-description">
                        The current medication management does not require specific interventions at this time.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card className="p-12 text-center" data-testid="empty-state-no-data">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-destructive/10 rounded-full">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold" data-testid="empty-no-data-title">Analysis Unavailable</h2>
              <p className="text-muted-foreground mt-1" data-testid="empty-no-data-description">
                Could not load medication safety analysis for this patient.
              </p>
            </div>
            <Button onClick={() => refetch()} data-testid="button-retry">
              Try Again
            </Button>
          </div>
        </Card>
      )}
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-medication-safety-disclaimer" />
    </div>
  );
}