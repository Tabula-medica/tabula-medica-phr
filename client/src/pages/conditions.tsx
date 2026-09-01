import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StatCardGrid, type StatCardItem } from "@/components/shared";
import { 
  Stethoscope, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Building2,
  Info,
  X,
  Activity,
  Calendar,
  ShieldAlert
} from "lucide-react";
import type { Problem, Allergy } from "@shared/schema";
import { ehrPlatformInfo } from "@shared/schema";

interface ProblemWithSource extends Problem {
  sourceFacility: string;
  sourcePlatform: string;
}

interface AllergyWithSource extends Allergy {
  sourceFacility: string;
  sourcePlatform: string;
}

function ProblemCard({ 
  problem,
  onExplain
}: { 
  problem: ProblemWithSource;
  onExplain: (term: string) => void;
}) {
  const platformData = ehrPlatformInfo[problem.sourcePlatform as keyof typeof ehrPlatformInfo];
  
  const categoryColors: Record<string, string> = {
    chronic: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    acute: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    preventive: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    social: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    other: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    resolved: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
    inactive: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    recurrence: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  
  const categoryLabels: Record<string, string> = {
    chronic: "Chronic",
    acute: "Acute",
    preventive: "Preventive",
    social: "Social",
    other: "Other",
  };

  const statusLabels: Record<string, string> = {
    active: "Active",
    resolved: "Resolved",
    inactive: "Inactive",
    recurrence: "Recurrence",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-problem-${problem.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h4 className="font-semibold" data-testid={`text-problem-name-${problem.id}`}>{problem.name}</h4>
              <Badge variant="outline" className={categoryColors[problem.category] || categoryColors.other} data-testid={`badge-problem-category-${problem.id}`}>
                {categoryLabels[problem.category] || problem.category}
              </Badge>
              <Badge variant="outline" className={statusColors[problem.status] || statusColors.active} data-testid={`badge-problem-status-${problem.id}`}>
                {statusLabels[problem.status] || problem.status}
              </Badge>
            </div>
            
            <div className="space-y-1 text-sm">
              {problem.icdCode && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">ICD-10: {problem.icdCode}</span>
                </p>
              )}
              {problem.notes && (
                <p className="text-xs text-muted-foreground">{problem.notes}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap mt-3 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{problem.sourceFacility}</span>
              <span className="text-muted-foreground/50">|</span>
              <span style={{ color: platformData?.color }}>{platformData?.name || problem.sourcePlatform}</span>
              {problem.diagnosedBy && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{problem.diagnosedBy}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap mt-2 text-xs text-muted-foreground">
              {problem.onsetDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Onset: {new Date(problem.onsetDate).toLocaleDateString()}
                </span>
              )}
              {problem.resolvedDate && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Resolved: {new Date(problem.resolvedDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExplain(problem.name)}
              data-testid={`button-explain-problem-${problem.id}`}
            >
              <Info className="h-4 w-4 mr-1" />
              Learn
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AllergyCard({ 
  allergy,
  onExplain
}: { 
  allergy: AllergyWithSource;
  onExplain: (term: string) => void;
}) {
  const platformData = ehrPlatformInfo[allergy.sourcePlatform as keyof typeof ehrPlatformInfo];
  
  const typeColors: Record<string, string> = {
    drug: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    food: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    environmental: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    other: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };

  const severityColors: Record<string, string> = {
    life_threatening: "bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20",
    severe: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    moderate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    mild: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };
  
  const typeLabels: Record<string, string> = {
    drug: "Drug",
    food: "Food",
    environmental: "Environmental",
    other: "Other",
  };
  
  const severityLabels: Record<string, string> = {
    life_threatening: "Life-Threatening",
    severe: "Severe",
    moderate: "Moderate",
    mild: "Mild",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-allergy-${allergy.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <h4 className="font-semibold" data-testid={`text-allergy-name-${allergy.id}`}>{allergy.name}</h4>
              <Badge variant="outline" className={typeColors[allergy.type] || typeColors.other} data-testid={`badge-allergy-type-${allergy.id}`}>
                {typeLabels[allergy.type] || allergy.type}
              </Badge>
              <Badge variant="outline" className={severityColors[allergy.severity] || severityColors.moderate} data-testid={`badge-allergy-severity-${allergy.id}`}>
                {(allergy.severity === 'severe' || allergy.severity === 'life_threatening') && <AlertTriangle className="h-3 w-3 mr-1" />}
                {severityLabels[allergy.severity] || allergy.severity}
              </Badge>
            </div>
            
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Reaction:</span> {allergy.reaction}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap mt-3 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{allergy.sourceFacility}</span>
              <span className="text-muted-foreground/50">|</span>
              <span style={{ color: platformData?.color }}>{platformData?.name || allergy.sourcePlatform}</span>
            </div>

            {allergy.onsetDate && (
              <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>First reported: {new Date(allergy.onsetDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExplain(allergy.name)}
              data-testid={`button-explain-allergy-${allergy.id}`}
            >
              <Info className="h-4 w-4 mr-1" />
              Learn
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExplanationModal({ term, onClose }: { term: string; onClose: () => void }) {
  return (
    <div role="presentation" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-md w-full animate-in fade-in zoom-in" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-2">
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            <Stethoscope className="h-5 w-5 text-primary" />
            About "{term}"
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-explanation">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            For detailed information about "{term}", including symptoms, treatments, and management, please consult your healthcare provider.
          </p>
          <p className="text-xs text-muted-foreground italic">
            This app does not provide medical advice. Always consult your healthcare provider about your conditions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Conditions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [explainTerm, setExplainTerm] = useState<string | null>(null);

  const { data: problems, isLoading: problemsLoading } = useQuery<ProblemWithSource[]>({
    queryKey: ['/api/problems'],
  });

  const { data: allergies, isLoading: allergiesLoading } = useQuery<AllergyWithSource[]>({
    queryKey: ['/api/allergies'],
  });

  const filteredProblems = problems?.filter(problem => 
    problem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (problem.icdCode && problem.icdCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAllergies = allergies?.filter(allergy => 
    allergy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    allergy.reaction.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProblems = filteredProblems?.filter(p => p.status === 'active') || [];
  const resolvedProblems = filteredProblems?.filter(p => p.status === 'resolved' || p.status === 'inactive') || [];
  const chronicProblems = filteredProblems?.filter(p => p.category === 'chronic') || [];

  const severeAllergies = filteredAllergies?.filter(a => a.severity === 'severe') || [];
  const drugAllergies = filteredAllergies?.filter(a => a.type === 'drug') || [];

  if (problemsLoading || allergiesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {explainTerm && <ExplanationModal term={explainTerm} onClose={() => setExplainTerm(null)} />}
      
      <PageHeader
        title="Conditions & Allergies"
        subtitle="View your medical conditions and known allergies from all connected health systems"
      />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conditions or allergies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <StatCardGrid
        columns={4}
        layout="icon-left"
        stats={[
          { label: "Active Conditions", value: activeProblems.length, icon: Activity, color: "text-blue-500", iconBg: "bg-blue-500/10", testId: "stat-active-conditions" },
          { label: "Chronic", value: chronicProblems.length, icon: Stethoscope, color: "text-purple-500", iconBg: "bg-purple-500/10", testId: "stat-chronic-conditions" },
          { label: "Severe Allergies", value: severeAllergies.length, icon: ShieldAlert, color: "text-red-500", iconBg: "bg-red-500/10", testId: "stat-severe-allergies" },
          { label: "Drug Allergies", value: drugAllergies.length, icon: AlertTriangle, color: "text-orange-500", iconBg: "bg-orange-500/10", testId: "stat-drug-allergies" },
        ] satisfies StatCardItem[]}
      />

      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList data-testid="tabs-conditions">
          <TabsTrigger value="conditions" data-testid="tab-conditions">
            Conditions ({filteredProblems?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="allergies" data-testid="tab-allergies">
            Allergies ({filteredAllergies?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="resolved" data-testid="tab-resolved">
            Resolved ({resolvedProblems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions" className="space-y-4">
          {activeProblems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Active Conditions</h3>
                <p className="text-sm text-muted-foreground">No active medical conditions found in your connected health systems.</p>
              </CardContent>
            </Card>
          ) : (
            activeProblems.map((problem) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                onExplain={setExplainTerm}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="allergies" className="space-y-4">
          {severeAllergies.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Severe Allergies - Critical Alert
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  You have {severeAllergies.length} severe allergy/allergies that can cause serious reactions. Make sure all healthcare providers are aware.
                </p>
              </CardContent>
            </Card>
          )}
          
          {filteredAllergies?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Allergies</h3>
                <p className="text-sm text-muted-foreground">No allergies found in your connected health systems.</p>
              </CardContent>
            </Card>
          ) : (
            filteredAllergies?.map((allergy) => (
              <AllergyCard
                key={allergy.id}
                allergy={allergy}
                onExplain={setExplainTerm}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {resolvedProblems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Resolved Conditions</h3>
                <p className="text-sm text-muted-foreground">No resolved or inactive conditions found.</p>
              </CardContent>
            </Card>
          ) : (
            resolvedProblems.map((problem) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                onExplain={setExplainTerm}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-conditions-disclaimer" />
    </div>
  );
}
