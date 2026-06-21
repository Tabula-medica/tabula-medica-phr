import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import {
  AlertTriangle,
  ShieldAlert,
  Syringe,
  Activity,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  GitMerge,
  Database,
  Cloud,
  Info,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DataRecord {
  id: string;
  name: string;
  source: "local" | "external";
  externalSource?: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive" | "resolved";
  details: Record<string, unknown>;
}

interface DataConflict {
  id: string;
  recordType: "allergy" | "immunization" | "condition";
  localRecord: DataRecord;
  externalRecord: DataRecord;
  conflictFields: string[];
  detectedAt: string;
  status: "pending" | "resolved";
}

interface DataStats {
  allergies: { total: number; synced: number; conflicts: number };
  immunizations: { total: number; synced: number; conflicts: number };
  conditions: { total: number; synced: number; conflicts: number };
}

function NoCDSBanner() {
  return (
    <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
      <Info className="h-4 w-4 text-amber-500" aria-hidden="true" />
      <AlertDescription className="text-sm">
        <strong>Educational Only:</strong> This dashboard displays health data for informational purposes only and is NOT a substitute for professional medical advice, diagnosis, or treatment.
      </AlertDescription>
    </Alert>
  );
}

function DataStatsCards({ stats }: { stats: DataStats | undefined }) {
  const categories = [
    { key: "allergies", label: "Allergies", icon: ShieldAlert, color: "text-red-500" },
    { key: "immunizations", label: "Immunizations", icon: Syringe, color: "text-blue-500" },
    { key: "conditions", label: "Conditions", icon: Activity, color: "text-purple-500" },
  ] as const;

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {categories.map((cat) => {
        const data = stats[cat.key];
        return (
          <Card key={cat.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${cat.color}`}>
                  <cat.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{cat.label}</p>
                  <p className="text-2xl font-bold">{data.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" aria-hidden="true" />
                  <span>{data.synced} synced</span>
                </div>
                {data.conflicts > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" />
                    <span className="text-amber-600">{data.conflicts} conflicts</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DataTable({ 
  data, 
  type, 
  isLoading 
}: { 
  data: DataRecord[] | undefined; 
  type: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No {type} records found
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record) => (
            <TableRow key={record.id} data-testid={`row-${type}-${record.id}`}>
              <TableCell className="font-medium">{record.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {record.source === "local" ? (
                    <Database className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Cloud className="h-3 w-3 text-blue-500" aria-hidden="true" />
                  )}
                  <span className="text-xs">
                    {record.source === "local" ? "Local" : record.externalSource || "External"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={record.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {record.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(record.updatedAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function ConflictResolutionDialog({
  conflict,
  open,
  onClose,
  onResolve,
}: {
  conflict: DataConflict | null;
  open: boolean;
  onClose: () => void;
  onResolve: (conflictId: string, resolution: "local" | "external" | "merge") => void;
}) {
  const [resolution, setResolution] = useState<"local" | "external" | "merge">("local");

  if (!conflict) return null;

  const handleResolve = () => {
    onResolve(conflict.id, resolution);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Resolve Data Conflict
          </DialogTitle>
          <DialogDescription>
            A conflict was detected for this {conflict.recordType} record. Choose which version to keep or merge the records.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 my-4">
          <Card className={resolution === "local" ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" aria-hidden="true" />
                <CardTitle className="text-sm">Local Record</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Name:</strong> {conflict.localRecord.name}</p>
              <p><strong>Updated:</strong> {new Date(conflict.localRecord.updatedAt).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                Stored in Tabula Medica
              </p>
            </CardContent>
          </Card>

          <Card className={resolution === "external" ? "ring-2 ring-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500" aria-hidden="true" />
                <CardTitle className="text-sm">External Record</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>Name:</strong> {conflict.externalRecord.name}</p>
              <p><strong>Source:</strong> {conflict.externalRecord.externalSource}</p>
              <p><strong>Updated:</strong> {new Date(conflict.externalRecord.updatedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Resolution Strategy</Label>
          <RadioGroup value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)}>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
              <RadioGroupItem value="local" id="local" />
              <Label htmlFor="local" className="flex-1 cursor-pointer">
                <span className="font-medium">Keep Local</span>
                <p className="text-xs text-muted-foreground">Use the record stored in Tabula Medica</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
              <RadioGroupItem value="external" id="external" />
              <Label htmlFor="external" className="flex-1 cursor-pointer">
                <span className="font-medium">Keep External</span>
                <p className="text-xs text-muted-foreground">Use the record from {conflict.externalRecord.externalSource}</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate">
              <RadioGroupItem value="merge" id="merge" />
              <Label htmlFor="merge" className="flex-1 cursor-pointer">
                <span className="font-medium">Merge Records</span>
                <p className="text-xs text-muted-foreground">Combine data from both sources (newest values preferred)</p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-resolve">
            Cancel
          </Button>
          <Button onClick={handleResolve} data-testid="button-confirm-resolve">
            Apply Resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictsSection({ 
  conflicts, 
  isLoading,
  onResolve,
}: { 
  conflicts: DataConflict[] | undefined;
  isLoading: boolean;
  onResolve: (conflictId: string, resolution: "local" | "external" | "merge") => void;
}) {
  const [selectedConflict, setSelectedConflict] = useState<DataConflict | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const pendingConflicts = conflicts?.filter(c => c.status === "pending") || [];

  if (pendingConflicts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" aria-hidden="true" />
        <p className="text-muted-foreground">No pending conflicts</p>
        <p className="text-xs text-muted-foreground mt-1">All records are synchronized</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pendingConflicts.map((conflict) => (
          <Card key={conflict.id} className="border-amber-500/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{conflict.localRecord.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {conflict.recordType.charAt(0).toUpperCase() + conflict.recordType.slice(1)} • 
                      Detected {new Date(conflict.detectedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {conflict.conflictFields.length} field(s) differ
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setSelectedConflict(conflict)}
                  data-testid={`button-resolve-${conflict.id}`}
                >
                  Resolve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConflictResolutionDialog
        conflict={selectedConflict}
        open={!!selectedConflict}
        onClose={() => setSelectedConflict(null)}
        onResolve={onResolve}
      />
    </>
  );
}

export default function AdminDataDashboard() {
  useSEO({
    title: "Data Dashboard - Admin | Tabula Medica",
    description: "View and manage health data records including allergies, immunizations, and conditions",
  });

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<DataStats>({
    queryKey: ["/api/admin/data-stats"],
  });

  const { data: allergies, isLoading: allergiesLoading, isError: allergiesError } = useQuery<DataRecord[]>({
    queryKey: ["/api/admin/allergies"],
  });

  const { data: immunizations, isLoading: immunizationsLoading, isError: immunizationsError } = useQuery<DataRecord[]>({
    queryKey: ["/api/admin/immunizations"],
  });

  const { data: conditions, isLoading: conditionsLoading, isError: conditionsError } = useQuery<DataRecord[]>({
    queryKey: ["/api/admin/conditions"],
  });

  const { data: conflicts, isLoading: conflictsLoading, isError: conflictsError, refetch: refetchConflicts } = useQuery<DataConflict[]>({
    queryKey: ["/api/admin/conflicts"],
  });

  const hasQueryError = statsError || allergiesError || immunizationsError || conditionsError || conflictsError;

  const resolveMutation = useMutation({
    mutationFn: async ({ conflictId, resolution }: { conflictId: string; resolution: string }) => {
      return apiRequest("POST", `/api/admin/conflicts/${conflictId}/resolve`, { resolution });
    },
    onSuccess: () => {
      toast({
        title: "Conflict Resolved",
        description: "The data conflict has been successfully resolved.",
      });
      refetchConflicts();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve the conflict. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleResolve = (conflictId: string, resolution: "local" | "external" | "merge") => {
    resolveMutation.mutate({ conflictId, resolution });
  };

  const pendingConflictsCount = conflicts?.filter(c => c.status === "pending").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild className="min-h-[44px] min-w-[44px]">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Back to Dashboard</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Data Dashboard</h1>
          <div className="ml-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
              }}
              data-testid="button-refresh-data"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <NoCDSBanner />

        {hasQueryError && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Some data failed to load. Please try refreshing the page or check your connection.
            </AlertDescription>
          </Alert>
        )}

        <DataStatsCards stats={stats} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-xl">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="allergies" data-testid="tab-allergies">Allergies</TabsTrigger>
            <TabsTrigger value="immunizations" data-testid="tab-immunizations">Immunizations</TabsTrigger>
            <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
            <TabsTrigger value="conflicts" data-testid="tab-conflicts" className="relative">
              Conflicts
              {pendingConflictsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {pendingConflictsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Overview</CardTitle>
                <CardDescription>
                  Summary of all health data records stored in Tabula Medica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden="true" />
                      Recent Allergies
                    </h3>
                    {allergiesLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <ul className="text-sm space-y-1">
                        {allergies?.slice(0, 3).map((a) => (
                          <li key={a.id} className="text-muted-foreground">{a.name}</li>
                        ))}
                        {(!allergies || allergies.length === 0) && (
                          <li className="text-muted-foreground">No allergies recorded</li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Syringe className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      Recent Immunizations
                    </h3>
                    {immunizationsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <ul className="text-sm space-y-1">
                        {immunizations?.slice(0, 3).map((i) => (
                          <li key={i.id} className="text-muted-foreground">{i.name}</li>
                        ))}
                        {(!immunizations || immunizations.length === 0) && (
                          <li className="text-muted-foreground">No immunizations recorded</li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" aria-hidden="true" />
                      Recent Conditions
                    </h3>
                    {conditionsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <ul className="text-sm space-y-1">
                        {conditions?.slice(0, 3).map((c) => (
                          <li key={c.id} className="text-muted-foreground">{c.name}</li>
                        ))}
                        {(!conditions || conditions.length === 0) && (
                          <li className="text-muted-foreground">No conditions recorded</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allergies" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Allergies</CardTitle>
                <CardDescription>
                  All allergy records from local and external sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable data={allergies} type="allergy" isLoading={allergiesLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="immunizations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Immunizations</CardTitle>
                <CardDescription>
                  All immunization records from local and external sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable data={immunizations} type="immunization" isLoading={immunizationsLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Medical Conditions</CardTitle>
                <CardDescription>
                  Past and current medical conditions from local and external sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable data={conditions} type="condition" isLoading={conditionsLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conflicts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Conflicts</CardTitle>
                <CardDescription>
                  Records that differ between Tabula Medica and external sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConflictsSection 
                  conflicts={conflicts} 
                  isLoading={conflictsLoading}
                  onResolve={handleResolve}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
