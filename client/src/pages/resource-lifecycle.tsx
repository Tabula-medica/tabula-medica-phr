import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Package, History, Upload, Download, Search, RefreshCw, 
  Play, Trash2, RotateCcw, CheckCircle, XCircle, AlertCircle,
  FileJson, Database, BarChart3, Layers, Clock, HardDrive
} from "lucide-react";

export default function ResourceLifecycle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [resourceType, setResourceType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [playgroundJson, setPlaygroundJson] = useState('{\n  "resourceType": "Patient",\n  "name": [{ "family": "Test", "given": ["User"] }],\n  "birthDate": "1990-01-01",\n  "gender": "female"\n}');

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/resource-lifecycle/stats"],
    refetchInterval: 30000
  });

  const { data: resources, isLoading: resourcesLoading } = useQuery<any>({
    queryKey: ["/api/resource-lifecycle/resources", { resourceType: resourceType !== 'all' ? resourceType : undefined }]
  });

  const { data: bulkOperations } = useQuery<any>({
    queryKey: ["/api/resource-lifecycle/bulk/operations"]
  });

  const { data: playgroundSessions } = useQuery<any>({
    queryKey: ["/api/resource-lifecycle/playground/sessions"]
  });

  const { data: usagePatterns } = useQuery<any>({
    queryKey: ["/api/resource-lifecycle/usage-patterns"]
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/resource-lifecycle/search", { text: query, semantic: true });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Found ${data.total} results` });
    }
  });

  const createPlaygroundMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/resource-lifecycle/playground/sessions", { name, createdBy: "admin" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-lifecycle/playground/sessions"] });
      toast({ title: "Playground session created" });
    }
  });

  const validateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/resource-lifecycle/playground/sessions/${sessionId}/validate`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ 
        title: data.valid ? "Validation Passed" : "Validation Failed",
        description: `${data.results?.filter((r: any) => r.valid).length || 0}/${data.results?.length || 0} resources valid`
      });
    }
  });

  const exportMutation = useMutation({
    mutationFn: async ({ format, resourceTypes }: { format: string; resourceTypes: string[] }) => {
      const res = await apiRequest("POST", "/api/resource-lifecycle/bulk/export", { format, resourceTypes, createdBy: "admin" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-lifecycle/bulk/operations"] });
      toast({ title: "Export Started", description: "Check bulk operations for progress" });
    }
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            FHIR Resource Lifecycle Management
          </h1>
          <p className="text-muted-foreground">
            Advanced versioning, bulk operations, resource playground, and usage analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/resource-lifecycle"] })} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalResources || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalVersions || 0} total versions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Bulk Operations</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeBulkOperations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.duplicatesDetected || 0}</div>
            <p className="text-xs text-muted-foreground">
              Duplicates | {stats?.orphanedResources || 0} orphaned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats?.storageUsedBytes || 0)}</div>
            <Progress value={Math.min(100, (stats?.storageUsedBytes || 0) / 10000000)} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card className="text-sm text-muted-foreground p-3 bg-muted/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        This resource data is for informational purposes only. Not for clinical decision-making.
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList data-testid="tabs-lifecycle">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="playground" data-testid="tab-playground">Playground</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Usage Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resource Type Distribution</CardTitle>
                <CardDescription>Breakdown by FHIR resource type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.resourceTypeBreakdown?.map((item: any) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{item.type}</span>
                      </div>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common lifecycle operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => exportMutation.mutate({ format: 'ndjson', resourceTypes: ['Patient', 'Observation'] })}
                  disabled={exportMutation.isPending}
                  data-testid="button-export-ndjson"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All as NDJSON
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => exportMutation.mutate({ format: 'fhir_bundle', resourceTypes: ['Patient', 'Condition'] })}
                  disabled={exportMutation.isPending}
                  data-testid="button-export-bundle"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as FHIR Bundle
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => createPlaygroundMutation.mutate(`Playground ${Date.now()}`)}
                  disabled={createPlaygroundMutation.isPending}
                  data-testid="button-new-playground"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Create New Playground
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">FHIR Resources</CardTitle>
                <CardDescription>Browse and manage FHIR resources with version history</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Search resources..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                    data-testid="input-search"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => searchMutation.mutate(searchQuery)}
                    disabled={searchMutation.isPending}
                    data-testid="button-search"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger className="w-40" data-testid="select-resource-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Patient">Patient</SelectItem>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="Condition">Condition</SelectItem>
                    <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {resourcesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {resources?.resources?.map((resource: any) => (
                    <div key={resource.id} className="p-4 border rounded-lg space-y-2 hover-elevate">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-primary" />
                          <span className="font-medium">{resource.resourceType}/{resource.id}</span>
                          <Badge variant="secondary">v{resource.meta?.versionId || 1}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" data-testid={`button-history-${resource.id}`}>
                            <History className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-delete-${resource.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {new Date(resource.meta?.lastUpdated).toLocaleString()}
                        {resource.meta?.source && ` | Source: ${resource.meta.source}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk Operations</CardTitle>
              <CardDescription>Import and export FHIR resources in bulk</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bulkOperations?.operations?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="w-12 h-12 mx-auto mb-2" />
                    No bulk operations yet
                  </div>
                ) : (
                  bulkOperations?.operations?.map((op: any) => (
                    <div key={op.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {op.type === 'import' ? <Upload className="w-4 h-4 text-blue-500" /> : <Download className="w-4 h-4 text-green-500" />}
                          <span className="font-medium capitalize">{op.type}</span>
                          <Badge variant="outline">{op.format.toUpperCase()}</Badge>
                        </div>
                        <Badge variant={
                          op.status === 'completed' ? 'default' :
                          op.status === 'processing' ? 'secondary' :
                          op.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {op.status}
                        </Badge>
                      </div>
                      <Progress value={(op.processedResources / op.totalResources) * 100} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{op.processedResources.toLocaleString()} / {op.totalResources.toLocaleString()} resources</span>
                        <span>Started: {new Date(op.startedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {op.resourceTypes.map((type: string) => (
                          <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playground" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Playground resources are for testing and validation only. Verify all data before pushing to production systems.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resource Editor</CardTitle>
                <CardDescription>Create and validate FHIR resources before pushing to production</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  value={playgroundJson}
                  onChange={(e) => setPlaygroundJson(e.target.value)}
                  className="font-mono h-64"
                  placeholder="Enter FHIR resource JSON..."
                  data-testid="textarea-playground"
                />
                <div className="flex gap-2">
                  <Button variant="outline" data-testid="button-validate-playground">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Validate
                  </Button>
                  <Button variant="outline" data-testid="button-push-playground">
                    <Upload className="w-4 h-4 mr-2" />
                    Push to Production
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Playground Sessions</CardTitle>
                <CardDescription>Saved playground sessions for testing</CardDescription>
              </CardHeader>
              <CardContent>
                {playgroundSessions?.sessions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Play className="w-12 h-12 mx-auto mb-2" />
                    No playground sessions
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playgroundSessions?.sessions?.map((session: any) => (
                      <div key={session.id} className="p-3 border rounded-lg flex items-center justify-between hover-elevate">
                        <div>
                          <div className="font-medium">{session.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.resources.length} resources | {session.status}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={
                            session.status === 'validated' ? 'default' :
                            session.status === 'pushed' ? 'secondary' : 'outline'
                          }>
                            {session.status}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => validateMutation.mutate(session.id)}
                            disabled={validateMutation.isPending}
                            data-testid={`button-validate-${session.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Pattern Analytics</CardTitle>
              <CardDescription>Resource utilization and optimization recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usagePatterns?.patterns?.map((pattern: any) => (
                  <div key={pattern.resourceType} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-primary" />
                        <span className="font-medium">{pattern.resourceType}</span>
                      </div>
                      <span className="text-lg font-bold">{pattern.totalCount.toLocaleString()}</span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="text-muted-foreground">Recent Access</div>
                        <div className="font-medium">{pattern.recentAccess.toLocaleString()}</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="text-muted-foreground">Avg Versions</div>
                        <div className="font-medium">{pattern.avgVersions.toFixed(1)}</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="text-muted-foreground">Duplicates</div>
                        <div className="font-medium text-yellow-500">{pattern.duplicateCount}</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="text-muted-foreground">Storage</div>
                        <div className="font-medium">{formatBytes(pattern.sizeBytes)}</div>
                      </div>
                    </div>

                    {pattern.recommendations?.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-yellow-500/10 p-2 rounded">
                        {pattern.recommendations.map((rec: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <AlertCircle className="w-3 h-3 mt-0.5 text-yellow-500" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
