import { useState, useEffect, useCallback } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Pill,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  GitMerge,
  AlertCircle,
  CheckCircle,
  Clock,
  Info,
  RefreshCw,
  Download,
  XCircle,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import type { 
  MergedMedicationGroup, 
  MedicationConflict, 
  MedicationListResponse,
  MedicationConflictType,
} from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CONFLICT_TYPE_LABELS: Record<MedicationConflictType, string> = {
  dose_mismatch: "Different Doses",
  frequency_mismatch: "Different Schedules",
  status_mismatch: "Status Conflict",
  prescriber_mismatch: "Different Prescribers",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
};

function ConflictCard({ conflict, onView }: { conflict: MedicationConflict; onView: () => void }) {
  useEffect(() => {
    onView();
  }, []);

  return (
    <Card className={`border ${SEVERITY_COLORS[conflict.severity]}`} data-testid={`card-conflict-${conflict.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-5 w-5 mt-0.5 ${conflict.severity === 'high' ? 'text-red-500' : conflict.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-medium" data-testid="text-conflict-type">
                {CONFLICT_TYPE_LABELS[conflict.conflictType]}
              </span>
              <Badge variant="outline" className={SEVERITY_COLORS[conflict.severity]} data-testid="badge-conflict-severity">
                {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)} Priority
              </Badge>
            </div>
            <div className="space-y-2">
              {conflict.sources.map((source, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm" data-testid={`text-conflict-source-${idx}`}>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{source.facility}:</span>
                  <span className="text-muted-foreground">{source.value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Talk to your doctor or pharmacist to confirm which is correct.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationGroupCard({ 
  group, 
  onViewConflict,
  onStatusChange,
  patientStatuses,
}: { 
  group: MergedMedicationGroup;
  onViewConflict: (conflictId: string) => void;
  onStatusChange: (medicationId: string, status: "taking" | "not_taking" | "unknown") => void;
  patientStatuses: Record<string, { status: string; confirmedAt?: string }>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const primary = group.primaryMedication;
  const currentStatus = patientStatuses[primary.id]?.status || primary.patientReported || "unknown";
  const isConfirmed = currentStatus === "taking" || currentStatus === "not_taking";

  return (
    <Card className="hover-elevate" data-testid={`card-medication-group-${group.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Pill className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg" data-testid="text-medication-name">{group.name}</h3>
              <Badge 
                variant="outline" 
                className={group.status === 'active' 
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                  : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                }
                data-testid="badge-medication-status"
              >
                {group.status === 'active' ? 'Active' : group.status === 'discontinued' ? 'Discontinued' : 'On Hold'}
              </Badge>
              {isConfirmed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1" data-testid="badge-patient-confirmed">
                      <UserCheck className="h-3 w-3" />
                      Confirmed
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>You confirmed: {currentStatus === "taking" ? "Taking this medication" : "Not taking this medication"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {group.sourceCount > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1" data-testid="badge-source-count">
                      <GitMerge className="h-3 w-3" />
                      {group.sourceCount} sources
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This medication appears in {group.sourceCount} different records</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {group.hasConflicts && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1" data-testid="badge-has-conflicts">
                      <AlertCircle className="h-3 w-3" />
                      {group.conflicts.length} conflict{group.conflicts.length > 1 ? 's' : ''}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>There are differences between your records that need review</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-muted-foreground">Dose:</span>
                <span className="font-medium" data-testid="text-dosage">{primary.dosage}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-muted-foreground">Schedule:</span>
                <span className="font-medium" data-testid="text-frequency">{primary.frequency}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-muted-foreground">From:</span>
                <span className="font-medium" data-testid="text-facility">{primary.facility}</span>
              </div>
              {primary.prescribedBy && (
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-muted-foreground">Prescribed by:</span>
                  <span className="font-medium" data-testid="text-prescriber">{primary.prescribedBy}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-2">Are you taking this medication?</p>
              <ToggleGroup 
                type="single" 
                value={currentStatus} 
                onValueChange={(value) => value && onStatusChange(primary.id, value as "taking" | "not_taking" | "unknown")}
                className="justify-start"
              >
                <ToggleGroupItem 
                  value="taking" 
                  aria-label="Taking"
                  className={currentStatus === "taking" ? "bg-green-500/20 text-green-700 dark:text-green-400" : ""}
                  data-testid="toggle-taking"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Taking
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="not_taking" 
                  aria-label="Not taking"
                  className={currentStatus === "not_taking" ? "bg-red-500/20 text-red-700 dark:text-red-400" : ""}
                  data-testid="toggle-not-taking"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Not Taking
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="unknown" 
                  aria-label="Unsure"
                  className={currentStatus === "unknown" ? "bg-gray-500/20" : ""}
                  data-testid="toggle-unsure"
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Unsure
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        {(group.duplicates.length > 0 || group.hasConflicts) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4 gap-2"
                data-testid="button-expand-details"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show {group.duplicates.length} duplicate{group.duplicates.length !== 1 ? 's' : ''} 
                    {group.hasConflicts && ` and ${group.conflicts.length} conflict${group.conflicts.length !== 1 ? 's' : ''}`}
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              {group.hasConflicts && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Conflicts to Review
                  </h4>
                  {group.conflicts.map((conflict) => (
                    <ConflictCard 
                      key={conflict.id} 
                      conflict={conflict} 
                      onView={() => onViewConflict(conflict.id)}
                    />
                  ))}
                </div>
              )}

              {group.duplicates.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Other Records
                  </h4>
                  <div className="space-y-2">
                    {group.duplicates.map((dup) => (
                      <div 
                        key={dup.id} 
                        className="p-3 bg-muted/50 rounded-md text-sm"
                        data-testid={`card-duplicate-${dup.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium">{dup.facility}</span>
                          <Badge variant="outline" className="text-xs">
                            {dup.dosage} - {dup.frequency}
                          </Badge>
                        </div>
                        {dup.prescribedBy && (
                          <p className="text-muted-foreground mt-1">
                            Prescribed by: {dup.prescribedBy}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export default function MedicationReconciliation() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"current" | "all">("current");
  const [patientStatuses, setPatientStatuses] = useState<Record<string, { status: string; confirmedAt?: string }>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<MedicationListResponse>({
    queryKey: ["/api/medications/reconciled"],
  });

  const trackAnalytics = useMutation({
    mutationFn: async (event: { eventType: string; medicationId?: string; conflictId?: string; view?: string; metadata?: Record<string, string> }) => {
      return apiRequest("POST", "/api/medications/analytics", event);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ medicationId, status }: { medicationId: string; status: string }) => {
      return apiRequest("PATCH", `/api/medications/${medicationId}/status`, { status });
    },
    onSuccess: async (response, variables) => {
      const responseData = await response.json();
      setPatientStatuses(prev => ({
        ...prev,
        [variables.medicationId]: { status: variables.status, confirmedAt: responseData.confirmedAt },
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/medications/reconciled"] });
      toast({
        title: "Status Updated",
        description: `Medication status set to "${variables.status === "taking" ? "Taking" : variables.status === "not_taking" ? "Not Taking" : "Unsure"}"`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update medication status. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data) {
      trackAnalytics.mutate({ eventType: "med_list_opened" });
    }
  }, [data?.totalCurrent]);

  const handleViewConflict = (conflictId: string) => {
    trackAnalytics.mutate({ 
      eventType: "med_conflict_viewed", 
      conflictId 
    });
  };

  const handleToggleView = (view: "current" | "all") => {
    setActiveView(view);
    trackAnalytics.mutate({ 
      eventType: "med_toggle_current_all", 
      view 
    });
  };

  const handleStatusChange = (medicationId: string, status: "taking" | "not_taking" | "unknown") => {
    updateStatusMutation.mutate({ medicationId, status });
  };

  const handleDownloadSnapshot = async () => {
    setIsDownloading(true);
    try {
      await apiRequest("POST", "/api/snapshot/analytics", { eventType: "snapshot_created" });
      
      const response = await fetch("/api/snapshot/pdf", { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-snapshot-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      await apiRequest("POST", "/api/snapshot/analytics", { eventType: "snapshot_downloaded" });
      
      toast({
        title: "Snapshot Downloaded",
        description: "Your health summary PDF has been downloaded.",
      });
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Could not generate snapshot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const medications = activeView === "current" 
    ? data?.currentMedications || []
    : data?.allMedications || [];

  const totalConflicts = medications.reduce((sum, g) => sum + g.conflicts.length, 0);
  const totalDuplicates = medications.reduce((sum, g) => sum + g.duplicates.length, 0);

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Medications</h2>
            <p className="text-muted-foreground mb-4">
              There was a problem loading your medication list. Please try again.
            </p>
            <Button onClick={() => refetch()} data-testid="button-retry">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-2" data-testid="heading-page-title">Medication List</h1>
            <p className="text-muted-foreground">
              Review your medications from all connected health records. 
              We combine duplicates and highlight any differences that need your attention.
            </p>
          </div>
          <Button 
            onClick={handleDownloadSnapshot} 
            disabled={isDownloading}
            variant="outline"
            data-testid="button-download-snapshot"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Summary
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <Tabs value={activeView} onValueChange={(v) => handleToggleView(v as "current" | "all")}>
              <TabsList>
                <TabsTrigger value="current" data-testid="tab-current-meds">
                  Current ({data?.totalCurrent || 0})
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all-meds">
                  All ({data?.totalAll || 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 text-sm">
              {totalConflicts > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" data-testid="badge-total-conflicts">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''}
                </Badge>
              )}
              {totalDuplicates > 0 && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" data-testid="badge-total-duplicates">
                  <GitMerge className="h-3 w-3 mr-1" />
                  {totalDuplicates} merged
                </Badge>
              )}
            </div>
          </div>

          {totalConflicts > 0 && (
            <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium" data-testid="text-conflict-alert-title">
                      {totalConflicts} medication conflict{totalConflicts !== 1 ? 's' : ''} found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your health records show different information for some medications. 
                      Review these with your doctor or pharmacist to confirm what&apos;s correct.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {medications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  {activeView === "current" ? "No Current Medications" : "No Medications Found"}
                </h2>
                <p className="text-muted-foreground">
                  {activeView === "current" 
                    ? "You don't have any active medications on file. Switch to 'All' to see discontinued medications."
                    : "No medication records found in your connected health sources."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {medications.map((group) => (
                <MedicationGroupCard 
                  key={group.id} 
                  group={group}
                  onViewConflict={handleViewConflict}
                  onStatusChange={handleStatusChange}
                  patientStatuses={patientStatuses}
                />
              ))}
            </div>
          )}

          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">About this list</p>
                  <p>
                    This list combines medications from all your connected health records. 
                    When the same medication appears in multiple records, we group them together 
                    and show you any differences. Always confirm your current medications with 
                    your healthcare provider.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-medication-reconciliation-disclaimer" />
    </div>
  );
}