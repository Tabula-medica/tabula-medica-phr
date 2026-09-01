import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Building2,
  ChevronRight,
  RefreshCw,
  Shield,
  Database,
  Link2,
  XCircle,
  Pill,
  FlaskConical,
  Activity,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { clickable } from "@/lib/a11y";

type DedupRecordType = "medication" | "lab_result" | "document" | "condition" | "allergy";
type ConflictStatus = "pending" | "resolved" | "dismissed";
type ConflictSeverity = "low" | "medium" | "high" | "critical";

interface DedupGroup {
  id: string;
  userId: string;
  recordType: DedupRecordType;
  status: string;
  canonicalName: string;
  canonicalCode?: string;
  canonicalData: Record<string, unknown>;
  matchingAlgorithm: string;
  matchScore: number;
  sourceCount: number;
  hasConflicts: boolean;
  conflictCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface ProvenanceLink {
  id: string;
  dedupGroupId: string;
  originalRecordId: string;
  recordType: DedupRecordType;
  sourceConnectionId: string;
  sourcePlatform: string;
  sourceFacility: string;
  importedAt: string;
  rawData: Record<string, unknown>;
  confidence: number;
  isPrimary: boolean;
}

interface DedupConflict {
  id: string;
  dedupGroupId: string;
  userId: string;
  fieldName: string;
  conflictType: string;
  values: { sourceId: string; value: unknown; sourcePlatform: string; sourceFacility: string }[];
  severity: ConflictSeverity;
  status: ConflictStatus;
  suggestedResolution?: unknown;
  resolvedValue?: unknown;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

interface DedupSummary {
  totalGroups: number;
  groupsByType: Record<string, number>;
  totalConflicts: number;
  pendingConflicts: number;
  resolvedConflicts: number;
  averageSourcesPerGroup: number;
}

function getRecordTypeIcon(type: DedupRecordType) {
  switch (type) {
    case "medication": return <Pill className="h-4 w-4" />;
    case "lab_result": return <FlaskConical className="h-4 w-4" />;
    case "document": return <FileText className="h-4 w-4" />;
    case "condition": return <Activity className="h-4 w-4" />;
    case "allergy": return <AlertCircle className="h-4 w-4" />;
    default: return <Database className="h-4 w-4" />;
  }
}

function getSeverityBadge(severity: ConflictSeverity) {
  const variants: Record<ConflictSeverity, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    low: { variant: "secondary", label: "Low" },
    medium: { variant: "default", label: "Medium" },
    high: { variant: "destructive", label: "High" },
    critical: { variant: "destructive", label: "Critical" },
  };
  const { variant, label } = variants[severity];
  return <Badge variant={variant} data-testid={`badge-severity-${severity}`}>{label}</Badge>;
}

function getStatusBadge(status: ConflictStatus) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "resolved":
      return <Badge variant="outline" className="text-green-600 border-green-600" data-testid="badge-status-resolved"><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Badge>;
    case "dismissed":
      return <Badge variant="outline" className="text-muted-foreground" data-testid="badge-status-dismissed"><XCircle className="h-3 w-3 mr-1" />Dismissed</Badge>;
  }
}

function formatConfidenceScore(score: number) {
  return `${Math.round(score * 100)}%`;
}

export default function DeduplicatedRecordsPage() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<DedupGroup | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<DedupConflict | null>(null);
  const [resolveValue, setResolveValue] = useState<string>("");
  const [resolveNote, setResolveNote] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRecordType, setSelectedRecordType] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<DedupSummary>({
    queryKey: ["/api/dedup-summary"],
  });

  const { data: groups, isLoading: groupsLoading, refetch: refetchGroups } = useQuery<DedupGroup[]>({
    queryKey: ["/api/dedup-groups", selectedRecordType],
    enabled: activeTab === "provenance",
  });

  const { data: conflicts, isLoading: conflictsLoading, refetch: refetchConflicts } = useQuery<DedupConflict[]>({
    queryKey: ["/api/dedup-conflicts"],
  });

  const { data: provenance, isLoading: provenanceLoading, refetch: refetchProvenance } = useQuery<{
    group: DedupGroup;
    provenanceLinks: ProvenanceLink[];
    conflicts: DedupConflict[];
  }>({
    queryKey: ["/api/deduplicated-records", selectedGroup?.id, "provenance"],
    enabled: !!selectedGroup,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ conflictId, resolvedValue, note }: { conflictId: string; resolvedValue: string; note: string }) => {
      return apiRequest("POST", `/api/dedup-conflicts/${conflictId}/resolve`, { resolvedValue, note });
    },
    onSuccess: () => {
      toast({
        title: "Conflict Resolved",
        description: "The data conflict has been resolved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dedup-conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dedup-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dedup-groups"] });
      if (selectedGroup) {
        refetchProvenance();
      }
      setSelectedConflict(null);
      setResolveValue("");
      setResolveNote("");
    },
    onError: () => {
      toast({
        title: "Resolution Failed",
        description: "Failed to resolve the conflict. Please try again.",
        variant: "destructive",
      });
    },
  });

  const pendingConflicts = conflicts?.filter(c => c.status === "pending") || [];

  const handleRecordTypeClick = (type: string) => {
    setSelectedRecordType(type);
    setActiveTab("provenance");
    setSelectedGroup(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <GitMerge className="h-6 w-6" />
            Record Deduplication
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            View merged health records from multiple sources and resolve data conflicts
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchConflicts();
            refetchGroups();
          }}
          data-testid="button-refresh-conflicts"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-groups">{summary.totalGroups}</p>
                  <p className="text-sm text-muted-foreground">Merged Record Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-avg-sources">{summary.averageSourcesPerGroup.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Avg Sources per Group</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pending-conflicts">{summary.pendingConflicts}</p>
                  <p className="text-sm text-muted-foreground">Pending Conflicts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-resolved-conflicts">{summary.resolvedConflicts}</p>
                  <p className="text-sm text-muted-foreground">Resolved Conflicts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            Conflicts
            {pendingConflicts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingConflicts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="provenance" data-testid="tab-provenance">Provenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {summary?.groupsByType && Object.keys(summary.groupsByType).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary.groupsByType).map(([type, count]) => (
                <Card 
                  key={type} 
                  className="hover-elevate cursor-pointer" 
                  onClick={() => handleRecordTypeClick(type)} 
                  data-testid={`card-record-type-${type}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getRecordTypeIcon(type as DedupRecordType)}
                        <div>
                          <p className="font-medium capitalize">{type.replace("_", " ")}s</p>
                          <p className="text-sm text-muted-foreground">{count} merged groups</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <GitMerge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2" data-testid="text-no-groups">No Deduplicated Records Yet</h3>
                  <p className="text-muted-foreground">
                    When you connect multiple health data sources, duplicate records will be automatically merged here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription data-testid="text-privacy-notice">
              Your health data is protected with HIPAA-compliant security. All deduplication activities are logged for audit purposes.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          {conflictsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pendingConflicts.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {pendingConflicts.map(conflict => (
                  <Card key={conflict.id} data-testid={`card-conflict-${conflict.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium capitalize" data-testid={`text-conflict-field-${conflict.id}`}>
                              {conflict.fieldName.replace("_", " ")} Mismatch
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {conflict.values.length} different values from {conflict.values.map(v => v.sourcePlatform).join(", ")}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {getSeverityBadge(conflict.severity)}
                              {getStatusBadge(conflict.status)}
                            </div>
                          </div>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedConflict(conflict);
                                setResolveValue("");
                                setResolveNote("");
                              }}
                              data-testid={`button-resolve-${conflict.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                Resolve Data Conflict
                              </DialogTitle>
                              <DialogDescription>
                                Choose which value to use for this record, or enter a custom value.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div>
                                <FieldCaption className="text-sm font-medium">Field: {conflict.fieldName}</FieldCaption>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Type: {conflict.conflictType.replace("_", " ")}
                                </p>
                              </div>
                              <Separator />
                              <div>
                                <FieldCaption className="text-sm font-medium mb-3 block">Conflicting Values</FieldCaption>
                                <RadioGroup value={resolveValue} onValueChange={setResolveValue}>
                                  {conflict.values.map((cv, idx) => (
                                    <div key={idx} className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
                                      <RadioGroupItem value={String(cv.value)} id={`value-${idx}`} data-testid={`radio-value-${idx}`} />
                                      <Label htmlFor={`value-${idx}`} className="flex-1 cursor-pointer">
                                        <span className="font-medium">{String(cv.value)}</span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                          from {cv.sourcePlatform}
                                        </span>
                                      </Label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              </div>
                              <div>
                                <Label htmlFor="note" className="text-sm font-medium">Resolution Note (optional)</Label>
                                <Textarea
                                  id="note"
                                  placeholder="Add a note about why you chose this value..."
                                  value={resolveNote}
                                  onChange={(e) => setResolveNote(e.target.value)}
                                  className="mt-2"
                                  data-testid="input-resolution-note"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                onClick={() => {
                                  if (resolveValue && selectedConflict) {
                                    resolveMutation.mutate({
                                      conflictId: selectedConflict.id,
                                      resolvedValue: resolveValue,
                                      note: resolveNote,
                                    });
                                  }
                                }}
                                disabled={!resolveValue || resolveMutation.isPending}
                                data-testid="button-confirm-resolve"
                              >
                                {resolveMutation.isPending ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Resolving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Resolve Conflict
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2" data-testid="text-no-conflicts">No Pending Conflicts</h3>
                  <p className="text-muted-foreground">
                    All data conflicts have been resolved. Your health records are fully synchronized.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="provenance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Record Groups</CardTitle>
                  <CardDescription>
                    {selectedRecordType ? `Showing ${selectedRecordType.replace("_", " ")}s` : "Select a record type"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {groupsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : groups && groups.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2 pr-2">
                        {groups.map(group => (
                          <div
                            key={group.id}
                            className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                              selectedGroup?.id === group.id ? "border-primary bg-primary/5" : ""
                            }`}
                            {...clickable(() => setSelectedGroup(group))}
                            data-testid={`card-group-${group.id}`}
                          >
                            <div className="flex items-center gap-2">
                              {getRecordTypeIcon(group.recordType)}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate" data-testid={`text-group-name-${group.id}`}>
                                  {group.canonicalName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {group.sourceCount} sources | Match: {formatConfidenceScore(group.matchScore)}
                                </p>
                              </div>
                              {group.hasConflicts && (
                                <Badge variant="outline" className="text-yellow-600">
                                  {group.conflictCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm" data-testid="text-no-groups-in-type">
                        {selectedRecordType 
                          ? `No ${selectedRecordType.replace("_", " ")} groups found`
                          : "Click a record type in Overview to view groups"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedGroup && provenance ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {getRecordTypeIcon(provenance.group.recordType)}
                        <div>
                          <CardTitle className="capitalize" data-testid="text-provenance-title">
                            {provenance.group.canonicalName}
                          </CardTitle>
                          <CardDescription>
                            Merged from {provenance.provenanceLinks.length} sources | Algorithm: {provenance.group.matchingAlgorithm}
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)} data-testid="button-close-provenance">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Source Records</h4>
                        <div className="space-y-3">
                          {provenance.provenanceLinks.map(link => (
                            <div key={link.id} className="p-4 rounded-lg border" data-testid={`card-provenance-${link.id}`}>
                              <div className="flex items-start justify-between flex-wrap gap-2">
                                <div className="flex items-start gap-3">
                                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-medium">{link.sourceFacility}</p>
                                    <p className="text-sm text-muted-foreground">{link.sourcePlatform}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Imported: {format(new Date(link.importedAt), "PPp")}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant={link.isPrimary ? "default" : "outline"} data-testid={`badge-confidence-${link.id}`}>
                                    {link.isPrimary ? "Primary" : formatConfidenceScore(link.confidence)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {provenance.conflicts.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Conflicts</h4>
                          <div className="space-y-2">
                            {provenance.conflicts.map(conflict => (
                              <div key={conflict.id} className="p-3 rounded-lg bg-muted flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  {conflict.status === "pending" ? (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )}
                                  <span className="capitalize">{conflict.fieldName.replace("_", " ")}</span>
                                </div>
                                {getStatusBadge(conflict.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : provenanceLoading ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-48" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2" data-testid="text-select-record">Select a Record</h3>
                      <p className="text-muted-foreground">
                        Click on a record group from the list to view its provenance and source history.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
