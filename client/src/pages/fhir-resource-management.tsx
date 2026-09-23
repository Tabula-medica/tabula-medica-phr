import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  RefreshCw,
  Database,
  History,
  ArrowLeftRight,
  FileCode,
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Activity,
  BarChart3,
} from "lucide-react";

interface ExternalSystem {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncDirection: string;
  supportedResources: string[];
}

interface SyncJob {
  id: string;
  externalSystemId: string;
  direction: string;
  status: string;
  resourceTypes: string[];
  totalResources: number;
  syncedResources: number;
  failedResources: number;
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

interface FHIRResource {
  id: string;
  resourceType: string;
  displayName: string;
  lastUpdated: string;
  source?: string;
}

interface ResourceDetail {
  id: string;
  resourceType: string;
  currentVersion: {
    versionId: string;
    data: Record<string, unknown>;
    meta: { lastUpdated: string; source?: string };
    createdBy: string;
    changeSummary: string;
  };
  versionHistory: Array<{
    versionId: string;
    createdAt: string;
    createdBy: string;
    changeType: string;
    changeSummary: string;
  }>;
  auditTrail: Array<{
    id: string;
    action: string;
    userId: string;
    timestamp: string;
  }>;
  codes: Array<{ system: string; code: string; display: string }>;
}

interface CodeSystem {
  id: string;
  name: string;
  version: string;
  description: string;
  totalCodes: number;
}

interface TranslationResult {
  sourceSystem: string;
  sourceCode: string;
  sourceDisplay: string;
  targetSystem: string;
  mappings: Array<{ code: string; display: string; equivalence: string; verified: boolean }>;
}

export default function FHIRResourceManagement() {
  const { toast } = useToast();
  const [selectedSystem, setSelectedSystem] = useState<ExternalSystem | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceDetail, setResourceDetail] = useState<ResourceDetail | null>(null);
  const [syncDirection, setSyncDirection] = useState<string>("bidirectional");
  const [sourceSystem, setSourceSystem] = useState<string>("");
  const [sourceCode, setSourceCode] = useState<string>("");
  const [targetSystem, setTargetSystem] = useState<string>("");
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [resourceDetailLoading, setResourceDetailLoading] = useState(false);
  const [resourceDetailError, setResourceDetailError] = useState<string | null>(null);

  const systemsQuery = useQuery<{ systems: ExternalSystem[] }>({
    queryKey: ["/api/fhir-sync/systems"],
  });

  const jobsQuery = useQuery<{ jobs: SyncJob[] }>({
    queryKey: ["/api/fhir-sync/jobs"],
  });

  const metricsQuery = useQuery<{ metrics: { totalSystems: number; activeSystems: number; totalJobs: number; completedJobs: number; totalResourcesSynced: number } }>({
    queryKey: ["/api/fhir-sync/metrics"],
  });

  const resourcesQuery = useQuery<{ resources: FHIRResource[] }>({
    queryKey: ["/api/fhir-resources"],
  });

  const codeSystemsQuery = useQuery<{ systems: CodeSystem[] }>({
    queryKey: ["/api/code-mapping/systems"],
  });

  const startSyncMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSystem) throw new Error("No system selected");
      const response = await apiRequest("POST", "/api/fhir-sync/start", {
        externalSystemId: selectedSystem.id,
        direction: syncDirection,
        resourceTypes: selectedSystem.supportedResources,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sync job started" });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync/metrics"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start sync", variant: "destructive" });
    },
  });

  const translateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/code-mapping/translate", {
        sourceSystem,
        sourceCode,
        targetSystem,
      });
      return response.json();
    },
    onSuccess: (data: { translation: TranslationResult }) => {
      setTranslationResult(data.translation);
    },
    onError: () => {
      toast({ title: "Error", description: "Translation failed", variant: "destructive" });
    },
  });

  const loadResourceDetail = async (resourceId: string) => {
    setResourceDetailLoading(true);
    setResourceDetailError(null);
    try {
      const response = await fetch(`/api/fhir-resources/${resourceId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setResourceDetail(data.resource);
      setSelectedResource(resourceId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setResourceDetailError(msg);
      toast({ title: "Error", description: `Failed to load resource: ${msg}`, variant: "destructive" });
    } finally {
      setResourceDetailLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "partial":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"><Activity className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Resource Management</h1>
          <p className="text-muted-foreground">Bi-directional sync, resource viewer, and code system mapping</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>External Systems</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-systems">
              {metricsQuery.isLoading ? "..." : metricsQuery.isError ? "-" : metricsQuery.data?.metrics.totalSystems ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Systems</CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="text-active-systems">
              {metricsQuery.isLoading ? "..." : metricsQuery.isError ? "-" : metricsQuery.data?.metrics.activeSystems ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sync Jobs</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-jobs">
              {metricsQuery.isLoading ? "..." : metricsQuery.isError ? "-" : metricsQuery.data?.metrics.totalJobs ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resources Synced</CardDescription>
            <CardTitle className="text-3xl text-blue-600" data-testid="text-resources-synced">
              {metricsQuery.isLoading ? "..." : metricsQuery.isError ? "-" : metricsQuery.data?.metrics.totalResourcesSynced ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="sync" className="space-y-6">
        <TabsList data-testid="tabs-main">
          <TabsTrigger value="sync" data-testid="tab-sync">
            <RefreshCw className="h-4 w-4 mr-2" />
            Data Sync
          </TabsTrigger>
          <TabsTrigger value="viewer" data-testid="tab-viewer">
            <Eye className="h-4 w-4 mr-2" />
            Resource Viewer
          </TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Code Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  External Systems
                </CardTitle>
                <CardDescription>Connected EHRs, labs, and pharmacies</CardDescription>
              </CardHeader>
              <CardContent>
                {systemsQuery.isLoading ? (
                  <p className="text-muted-foreground">Loading systems...</p>
                ) : systemsQuery.isError ? (
                  <div className="text-center py-8">
                    <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <p className="text-red-500">Failed to load systems</p>
                  </div>
                ) : systemsQuery.data?.systems && systemsQuery.data.systems.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {systemsQuery.data.systems.map((system) => (
                        <div
                          key={system.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                            selectedSystem?.id === system.id ? "border-primary bg-accent" : ""
                          }`}
                          {...clickable(() => setSelectedSystem(system))}
                          data-testid={`card-system-${system.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{system.name}</span>
                            <Badge variant={system.isActive ? "default" : "secondary"}>
                              {system.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{system.type}</p>
                          {system.lastSyncAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last sync: {new Date(system.lastSyncAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No systems connected.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sync Control</CardTitle>
                <CardDescription>
                  {selectedSystem ? `Configure sync for ${selectedSystem.name}` : "Select a system to configure sync"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedSystem ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldCaption>Endpoint</FieldCaption>
                        <p className="text-sm text-muted-foreground truncate">{selectedSystem.endpoint}</p>
                      </div>
                      <div>
                        <FieldCaption>Supported Resources</FieldCaption>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedSystem.supportedResources.slice(0, 4).map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                          {selectedSystem.supportedResources.length > 4 && (
                            <Badge variant="outline" className="text-xs">+{selectedSystem.supportedResources.length - 4}</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="fhir-resource-management-sync-direction">Sync Direction</Label>
                      <Select value={syncDirection} onValueChange={setSyncDirection}>
                        <SelectTrigger id="fhir-resource-management-sync-direction" data-testid="select-sync-direction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound (Pull)</SelectItem>
                          <SelectItem value="outbound">Outbound (Push)</SelectItem>
                          <SelectItem value="bidirectional">Bidirectional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => startSyncMutation.mutate()}
                      disabled={startSyncMutation.isPending}
                      data-testid="button-start-sync"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${startSyncMutation.isPending ? "animate-spin" : ""}`} />
                      {startSyncMutation.isPending ? "Starting Sync..." : "Start Sync"}
                    </Button>

                    <Separator />

                    <div>
                      <FieldCaption>Recent Sync Jobs</FieldCaption>
                      {jobsQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground mt-2">Loading jobs...</p>
                      ) : jobsQuery.isError ? (
                        <p className="text-sm text-red-500 mt-2">Failed to load jobs</p>
                      ) : jobsQuery.data?.jobs && jobsQuery.data.jobs.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {jobsQuery.data.jobs.slice(0, 5).map((job) => (
                            <div key={job.id} className="flex items-center justify-between p-2 rounded border text-sm">
                              <div>
                                <span className="font-medium">{job.direction}</span>
                                <span className="text-muted-foreground ml-2">
                                  {job.syncedResources}/{job.totalResources} resources
                                </span>
                              </div>
                              {getStatusBadge(job.status)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">No sync jobs yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select an external system to configure synchronization.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="viewer" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  FHIR Resources
                </CardTitle>
                <CardDescription>Browse and inspect resources</CardDescription>
              </CardHeader>
              <CardContent>
                {resourcesQuery.isLoading ? (
                  <p className="text-muted-foreground">Loading resources...</p>
                ) : resourcesQuery.isError ? (
                  <div className="text-center py-8">
                    <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <p className="text-red-500">Failed to load resources</p>
                  </div>
                ) : resourcesQuery.data?.resources && resourcesQuery.data.resources.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {resourcesQuery.data.resources.map((resource) => (
                        <div
                          key={resource.id}
                          className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                            selectedResource === resource.id ? "border-primary bg-accent" : ""
                          }`}
                          {...clickable(() => loadResourceDetail(resource.id))}
                          data-testid={`card-resource-${resource.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate">{resource.displayName}</span>
                            <Badge variant="outline">{resource.resourceType}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Updated: {new Date(resource.lastUpdated).toLocaleDateString()}
                          </p>
                          {resource.source && (
                            <p className="text-xs text-muted-foreground">Source: {resource.source}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No resources found.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Resource Detail</CardTitle>
                <CardDescription>
                  {resourceDetail ? `${resourceDetail.resourceType} - ${resourceDetail.id}` : "Select a resource to view details"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resourceDetailLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-4" />
                    <p className="text-muted-foreground">Loading resource details...</p>
                  </div>
                ) : resourceDetailError ? (
                  <div className="text-center py-12">
                    <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-red-500">Failed to load resource: {resourceDetailError}</p>
                  </div>
                ) : resourceDetail ? (
                  <Tabs defaultValue="data">
                    <TabsList>
                      <TabsTrigger value="data">Data</TabsTrigger>
                      <TabsTrigger value="history">Version History</TabsTrigger>
                      <TabsTrigger value="audit">Audit Trail</TabsTrigger>
                      <TabsTrigger value="codes">Codes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="data" className="mt-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <FieldCaption>Version</FieldCaption>
                            <p className="text-muted-foreground">{resourceDetail.currentVersion.versionId}</p>
                          </div>
                          <div>
                            <FieldCaption>Last Updated</FieldCaption>
                            <p className="text-muted-foreground">{new Date(resourceDetail.currentVersion.meta.lastUpdated).toLocaleString()}</p>
                          </div>
                          <div>
                            <FieldCaption>Source</FieldCaption>
                            <p className="text-muted-foreground">{resourceDetail.currentVersion.meta.source || "Unknown"}</p>
                          </div>
                          <div>
                            <FieldCaption>Last Change</FieldCaption>
                            <p className="text-muted-foreground">{resourceDetail.currentVersion.changeSummary}</p>
                          </div>
                        </div>
                        <Separator />
                        <ScrollArea className="h-[200px]">
                          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                            {JSON.stringify(resourceDetail.currentVersion.data, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4">
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Version</TableHead>
                              <TableHead>Change</TableHead>
                              <TableHead>By</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-mono">{resourceDetail.currentVersion.versionId}</TableCell>
                              <TableCell>{resourceDetail.currentVersion.changeSummary}</TableCell>
                              <TableCell>{resourceDetail.currentVersion.createdBy}</TableCell>
                              <TableCell>{new Date(resourceDetail.currentVersion.meta.lastUpdated).toLocaleDateString()}</TableCell>
                            </TableRow>
                            {resourceDetail.versionHistory.map((version) => (
                              <TableRow key={version.versionId}>
                                <TableCell className="font-mono">{version.versionId}</TableCell>
                                <TableCell>{version.changeSummary}</TableCell>
                                <TableCell>{version.createdBy}</TableCell>
                                <TableCell>{new Date(version.createdAt).toLocaleDateString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="audit" className="mt-4">
                      <ScrollArea className="h-[300px]">
                        {resourceDetail.auditTrail.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Timestamp</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {resourceDetail.auditTrail.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell><Badge variant="outline">{entry.action}</Badge></TableCell>
                                  <TableCell>{entry.userId}</TableCell>
                                  <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No audit entries yet.</p>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="codes" className="mt-4">
                      <div className="space-y-2">
                        {resourceDetail.codes.map((code, index) => (
                          <div key={index} className="p-3 rounded border">
                            <div className="flex items-center justify-between">
                              <Badge>{code.system}</Badge>
                              <span className="font-mono text-sm">{code.code}</span>
                            </div>
                            <p className="text-sm mt-1">{code.display}</p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a resource to view its details, version history, and audit trail.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  Code Translation
                </CardTitle>
                <CardDescription>Translate codes between SNOMED CT, LOINC, ICD-10, and RxNorm</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fhir-resource-management-source-code-system">Source Code System</Label>
                  <Select value={sourceSystem} onValueChange={setSourceSystem}>
                    <SelectTrigger id="fhir-resource-management-source-code-system" data-testid="select-source-system">
                      <SelectValue placeholder="Select source system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SNOMED_CT">SNOMED CT</SelectItem>
                      <SelectItem value="LOINC">LOINC</SelectItem>
                      <SelectItem value="ICD10_CM">ICD-10-CM</SelectItem>
                      <SelectItem value="RXNORM">RxNorm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fhir-resource-management-source-code">Source Code</Label>
                  <Input id="fhir-resource-management-source-code"
                    placeholder="Enter code (e.g., 44054006)"
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    data-testid="input-source-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fhir-resource-management-target-code-system">Target Code System</Label>
                  <Select value={targetSystem} onValueChange={setTargetSystem}>
                    <SelectTrigger id="fhir-resource-management-target-code-system" data-testid="select-target-system">
                      <SelectValue placeholder="Select target system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SNOMED_CT">SNOMED CT</SelectItem>
                      <SelectItem value="LOINC">LOINC</SelectItem>
                      <SelectItem value="ICD10_CM">ICD-10-CM</SelectItem>
                      <SelectItem value="RXNORM">RxNorm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={() => translateMutation.mutate()}
                  disabled={translateMutation.isPending || !sourceSystem || !sourceCode || !targetSystem}
                  data-testid="button-translate"
                >
                  {translateMutation.isPending ? "Translating..." : "Translate Code"}
                </Button>

                {translationResult && (
                  <div className="mt-4 p-4 rounded border bg-muted/50">
                    <div className="mb-3">
                      <FieldCaption>Source</FieldCaption>
                      <p className="text-sm">
                        <Badge variant="outline">{translationResult.sourceSystem}</Badge>
                        <span className="font-mono ml-2">{translationResult.sourceCode}</span>
                        <span className="ml-2">{translationResult.sourceDisplay}</span>
                      </p>
                    </div>
                    <Separator className="my-3" />
                    <div>
                      <FieldCaption>Mappings to {translationResult.targetSystem}</FieldCaption>
                      {translationResult.mappings.length > 0 ? (
                        <div className="space-y-2 mt-2">
                          {translationResult.mappings.map((mapping, idx) => (
                            <div key={idx} className="p-2 rounded border bg-background">
                              <div className="flex items-center justify-between">
                                <span className="font-mono">{mapping.code}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={mapping.equivalence === "equivalent" ? "default" : "secondary"}>
                                    {mapping.equivalence}
                                  </Badge>
                                  {mapping.verified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{mapping.display}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">No mappings found.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Code Systems
                </CardTitle>
                <CardDescription>Supported terminology systems</CardDescription>
              </CardHeader>
              <CardContent>
                {codeSystemsQuery.isLoading ? (
                  <p className="text-muted-foreground">Loading code systems...</p>
                ) : codeSystemsQuery.isError ? (
                  <div className="text-center py-8">
                    <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <p className="text-red-500">Failed to load code systems</p>
                  </div>
                ) : codeSystemsQuery.data?.systems ? (
                  <div className="space-y-3">
                    {codeSystemsQuery.data.systems.map((system) => (
                      <div key={system.id} className="p-4 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{system.name}</h4>
                          <Badge variant="outline">{system.version}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{system.description}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Total Codes: {system.totalCodes.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No code systems available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
