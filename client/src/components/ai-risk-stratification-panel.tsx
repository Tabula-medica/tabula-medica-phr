import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronUp, 
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Sparkles,
  Heart,
  Activity,
  Users,
  Pill,
  Building2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RiskFactorData {
  demographics: { age: number; gender: string };
  conditions: Array<{ name: string; code?: string; status: string }>;
  medications: Array<{ name: string; status: string }>;
  vitals: Array<{ type: string; value: number; unit: string; date: string }>;
  labResults: Array<{ name: string; value: number; unit: string; abnormal?: boolean }>;
  socialHistory?: { smokingStatus?: string; alcoholUse?: string; exerciseLevel?: string };
  encounters: Array<{ type: string; date: string }>;
}

interface RiskCategory {
  category: string;
  score: number;
  level: 'low' | 'moderate' | 'high' | 'very-high';
  factors: string[];
  description: string;
}

interface RiskStratificationResult {
  patientId: string;
  overallRiskLevel: 'low' | 'moderate' | 'high' | 'very-high';
  overallScore: number;
  categories: RiskCategory[];
  documentedRiskFactors: string[];
  protectiveFactors: string[];
  dataQualityNotes: string[];
  generatedAt: string;
  disclaimer: string;
}

interface AIRiskStratificationPanelProps {
  patientId: string;
  riskData: RiskFactorData;
  showDisclaimer?: boolean;
  onGenerated?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Cardiovascular': <Heart className="h-4 w-4" />,
  'Metabolic': <Activity className="h-4 w-4" />,
  'Fall Risk': <Users className="h-4 w-4" />,
  'Medication-Related': <Pill className="h-4 w-4" />,
  'Hospital Readmission': <Building2 className="h-4 w-4" />,
  'Respiratory': <Activity className="h-4 w-4" />
};

export function AIRiskStratificationPanel({ 
  patientId, 
  riskData,
  showDisclaimer = true,
  onGenerated
}: AIRiskStratificationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [result, setResult] = useState<RiskStratificationResult | null>(null);

  const stratifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/ai-clinical/risk-stratification/${patientId}`, riskData);
      return await response.json() as { success: boolean; riskStratification: RiskStratificationResult };
    },
    onSuccess: (data) => {
      setResult(data.riskStratification);
      onGenerated?.();
    }
  });

  const handleStratify = () => {
    stratifyMutation.mutate();
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'moderate': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'very-high': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskLevelIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'moderate': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'very-high': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getProgressColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'moderate': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'very-high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card data-testid="ai-risk-stratification-panel">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">AI Risk Stratification</CardTitle>
              <Badge variant="outline" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                Informational Only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!result && (
                <Button 
                  onClick={handleStratify}
                  disabled={stratifyMutation.isPending}
                  size="sm"
                  data-testid="button-stratify-risk"
                >
                  {stratifyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze Risk Factors
                    </>
                  )}
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-toggle-risk">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {showDisclaimer && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertTitle className="text-purple-800 dark:text-purple-200">Documentation Organization Only</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-300 text-sm">
                  Risk scores are based solely on documented factors and do not constitute clinical risk prediction or medical advice.
                </AlertDescription>
              </Alert>
            )}

            {stratifyMutation.isError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Analysis Failed</AlertTitle>
                <AlertDescription>
                  Unable to perform risk stratification. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {!result && !stratifyMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click "Analyze Risk Factors" to organize documented risk factors.</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Overall Risk Level */}
                <div className={`p-4 rounded-lg ${getRiskLevelColor(result.overallRiskLevel)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRiskLevelIcon(result.overallRiskLevel)}
                      <div>
                        <h4 className="font-semibold">Overall Documented Risk Level</h4>
                        <p className="text-sm capitalize" data-testid="text-overall-risk-level">
                          {result.overallRiskLevel.replace('-', ' ')} ({result.overallScore}%)
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-lg font-bold">
                      {result.overallScore}%
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <Progress 
                      value={result.overallScore} 
                      className={`h-2 ${getProgressColor(result.overallRiskLevel)}`}
                    />
                  </div>
                </div>

                {/* Risk Categories */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Risk Categories</h4>
                  {result.categories.map((category, i) => (
                    <RiskCategoryCard 
                      key={i} 
                      category={category}
                      testId={`category-${i}`}
                    />
                  ))}
                </div>

                {/* Documented Risk Factors */}
                {result.documentedRiskFactors.length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Documented Risk Factors
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.documentedRiskFactors.map((factor, i) => (
                        <Badge 
                          key={i} 
                          variant="outline"
                          data-testid={`badge-risk-factor-${i}`}
                        >
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Protective Factors */}
                {result.protectiveFactors.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-800 dark:text-green-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Protective Factors
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.protectiveFactors.map((factor, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          data-testid={`badge-protective-factor-${i}`}
                        >
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Quality Notes */}
                {result.dataQualityNotes.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <Info className="h-4 w-4" />
                      Data Quality Notes
                    </h5>
                    <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      {result.dataQualityNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generation Info */}
                <div className="text-xs text-muted-foreground text-right">
                  Generated: {new Date(result.generatedAt).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function RiskCategoryCard({ category, testId }: { category: RiskCategory; testId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'moderate': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'very-high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              {CATEGORY_ICONS[category.category] || <Activity className="h-4 w-4" />}
              <span className="font-medium" data-testid={`text-${testId}-name`}>{category.category}</span>
              <Badge 
                variant="secondary" 
                className="text-xs capitalize"
                data-testid={`badge-${testId}-level`}
              >
                {category.level.replace('-', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24">
                <Progress value={category.score} className={`h-2 ${getLevelColor(category.level)}`} />
              </div>
              <span className="text-sm font-medium w-10 text-right">{category.score}%</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t space-y-2">
            <p className="text-sm text-muted-foreground">{category.description}</p>
            {category.factors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {category.factors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {factor}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
