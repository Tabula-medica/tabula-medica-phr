import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Database, FileJson, Server, Shield, Clock, AlertTriangle, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Search } from "lucide-react";

interface FhirApiActivity {
  id: string;
  timestamp: string;
  method: string;
  resourceType: string;
  resourceId?: string;
  operation: string;
  statusCode: number;
  responseTimeMs: number;
  clientId?: string;
}

interface UsageMetrics {
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7d: number;
  avgResponseTimeMs: number;
  errorRate: number;
  resourceBreakdown: Array<{ resourceType: string; count: number; avgLatencyMs: number }>;
  recentActivity: FhirApiActivity[];
  topOperations: Array<{ operation: string; count: number }>;
  statusCodeBreakdown: Array<{ statusCode: number; count: number }>;
}

interface ResourceInfo {
  supported: string[];
  counts: Record<string, number>;
}

export default function FhirR4ApiDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: metrics, isLoading: metricsLoading } = useQuery<UsageMetrics>({
    queryKey: ["/api/fhir/r4-api/usage"],
    refetchInterval: 15000,
  });

  const { data: resourceInfo, isLoading: resourcesLoading } = useQuery<ResourceInfo>({
    queryKey: ["/api/fhir/r4-api/resources"],
  });

  const totalResources = resourceInfo ? Object.values(resourceInfo.counts).reduce((a, b) => a + b, 0) : 0;

  const filteredActivity = (metrics?.recentActivity || []).filter(a => {
    if (searchFilter && !a.resourceType.toLowerCase().includes(searchFilter.toLowerCase()) && !a.operation.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    if (statusFilter === "success" && a.statusCode >= 400) return false;
    if (statusFilter === "error" && a.statusCode < 400) return false;
    return true;
  });

  const getStatusColor = (code: number) => {
    if (code < 300) return "default";
    if (code < 400) return "secondary";
    return "destructive";
  };

  const getOperationIcon = (op: string) => {
    switch (op) {
      case "read": return <Search className="h-3.5 w-3.5" />;
      case "search": return <Database className="h-3.5 w-3.5" />;
      case "create": return <ArrowDownToLine className="h-3.5 w-3.5" />;
      case "export": return <ArrowUpFromLine className="h-3.5 w-3.5" />;
      case "import": return <ArrowDownToLine className="h-3.5 w-3.5" />;
      case "metadata": return <Server className="h-3.5 w-3.5" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  if (metricsLoading || resourcesLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="loading-state">
        <h1 className="text-2xl font-bold">FHIR R4 API Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR R4 API Dashboard</h1>
          <p className="text-muted-foreground mt-1">USCDI V3 compliant data exchange interface</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1" data-testid="badge-fhir-version">
            <FileJson className="h-3 w-3" /> FHIR R4 v4.0.1
          </Badge>
          <Badge variant="default" className="gap-1 bg-green-600" data-testid="badge-api-status">
            <CheckCircle2 className="h-3 w-3" /> Active
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold" data-testid="text-total-requests">{metrics?.totalRequests || 0}</p>
                <p className="text-xs text-muted-foreground">{metrics?.requestsLast24h || 0} in last 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resources Stored</p>
                <p className="text-2xl font-bold" data-testid="text-total-resources">{totalResources}</p>
                <p className="text-xs text-muted-foreground">{resourceInfo?.supported.length || 0} resource types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold" data-testid="text-avg-response">{metrics?.avgResponseTimeMs || 0}ms</p>
                <p className="text-xs text-muted-foreground">across all endpoints</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold" data-testid="text-error-rate">{metrics?.errorRate || 0}%</p>
                <p className="text-xs text-muted-foreground">{metrics?.requestsLast7d || 0} requests (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Resource Overview</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">API Activity</TabsTrigger>
          <TabsTrigger value="endpoints" data-testid="tab-endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="import-export" data-testid="tab-import-export">Import / Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">USCDI V3 Resources</CardTitle>
                <CardDescription>Supported FHIR R4 resource types and current counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(resourceInfo?.supported || []).map(rt => {
                    const count = resourceInfo?.counts[rt] || 0;
                    return (
                      <div key={rt} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50" data-testid={`row-resource-${rt}`}>
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">{rt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{count} stored</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Operations</CardTitle>
                <CardDescription>Most frequently used API operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(metrics?.topOperations || []).map(op => {
                    const maxCount = (metrics?.topOperations[0]?.count || 1);
                    const pct = Math.round((op.count / maxCount) * 100);
                    return (
                      <div key={op.operation} className="space-y-1" data-testid={`row-operation-${op.operation}`}>
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {getOperationIcon(op.operation)}
                            <span className="capitalize font-medium">{op.operation}</span>
                          </div>
                          <span className="text-muted-foreground">{op.count} requests</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Response Codes</h4>
                  <div className="flex flex-wrap gap-2">
                    {(metrics?.statusCodeBreakdown || []).map(sc => (
                      <Badge key={sc.statusCode} variant={getStatusColor(sc.statusCode)} data-testid={`badge-status-${sc.statusCode}`}>
                        {sc.statusCode}: {sc.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Resource Latency Breakdown</CardTitle>
                <CardDescription>Average response time per resource type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(metrics?.resourceBreakdown || []).map(rb => (
                    <div key={rb.resourceType} className="p-3 rounded-lg border bg-card" data-testid={`card-latency-${rb.resourceType}`}>
                      <p className="text-xs text-muted-foreground truncate">{rb.resourceType}</p>
                      <p className="text-lg font-bold">{rb.avgLatencyMs}ms</p>
                      <p className="text-xs text-muted-foreground">{rb.count} req</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent API Activity</CardTitle>
                  <CardDescription>Live feed of FHIR R4 API requests</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Filter by resource or operation..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="w-64"
                    data-testid="input-activity-filter"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32" data-testid="select-status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredActivity.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-activity">No activity matching filters</p>
                ) : (
                  filteredActivity.map((a, idx) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 text-sm border-b last:border-0" data-testid={`row-activity-${idx}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant={a.method === "POST" ? "default" : "outline"} className="text-xs w-14 justify-center">
                          {a.method}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {getOperationIcon(a.operation)}
                          <span className="font-medium">{a.resourceType}</span>
                          {a.resourceId && <span className="text-muted-foreground">/{a.resourceId}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.clientId && <span className="text-xs text-muted-foreground hidden md:inline">{a.clientId}</span>}
                        <Badge variant={getStatusColor(a.statusCode)} className="text-xs">{a.statusCode}</Badge>
                        <span className="text-xs text-muted-foreground w-12 text-right">{a.responseTimeMs}ms</span>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {new Date(a.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" /> FHIR R4 API Endpoints
              </CardTitle>
              <CardDescription>Available RESTful endpoints for health data exchange</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 rounded-lg border" data-testid="endpoint-metadata">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">GET</Badge>
                    <code className="text-sm font-mono">/api/fhir/r4/metadata</code>
                  </div>
                  <p className="text-xs text-muted-foreground ml-12">Returns the CapabilityStatement describing this server's FHIR capabilities</p>
                </div>

                {(resourceInfo?.supported || []).map(rt => (
                  <div key={rt} className="p-3 rounded-lg border space-y-2" data-testid={`endpoint-group-${rt}`}>
                    <p className="text-sm font-semibold">{rt}</p>
                    <div className="pl-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-14 justify-center">GET</Badge>
                        <code className="text-xs font-mono">/api/fhir/r4/{rt}</code>
                        <span className="text-xs text-muted-foreground">Search {rt} resources</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs w-14 justify-center">GET</Badge>
                        <code className="text-xs font-mono">/api/fhir/r4/{rt}/:id</code>
                        <span className="text-xs text-muted-foreground">Read specific {rt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs w-14 justify-center">POST</Badge>
                        <code className="text-xs font-mono">/api/fhir/r4/{rt}</code>
                        <span className="text-xs text-muted-foreground">Create (import) {rt}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-3 rounded-lg border space-y-2" data-testid="endpoint-bundle">
                  <p className="text-sm font-semibold">Bundle &amp; Export Operations</p>
                  <div className="pl-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs w-14 justify-center">POST</Badge>
                      <code className="text-xs font-mono">/api/fhir/r4-import/bundle</code>
                      <span className="text-xs text-muted-foreground">Import a FHIR Bundle (transaction/batch)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-14 justify-center">GET</Badge>
                      <code className="text-xs font-mono">/api/fhir/r4-export</code>
                      <span className="text-xs text-muted-foreground">Bulk export all resources</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs w-14 justify-center">POST</Badge>
                      <code className="text-xs font-mono">/api/fhir/r4-export/patient</code>
                      <span className="text-xs text-muted-foreground">Patient-level bulk export</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import-export" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5" /> Data Import
                </CardTitle>
                <CardDescription>Import FHIR resources from external systems</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Single Resource Import</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    POST individual FHIR resources to their respective endpoints. The API validates the resource type and assigns an ID.
                  </p>
                  <code className="text-xs font-mono block p-2 bg-background rounded border">
                    POST /api/fhir/r4/&lbrace;ResourceType&rbrace;
                  </code>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Bundle Import</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Import multiple resources at once via a FHIR Bundle. Supports transaction and batch bundles with per-entry status reporting.
                  </p>
                  <code className="text-xs font-mono block p-2 bg-background rounded border">
                    POST /api/fhir/r4-import/bundle
                  </code>
                </div>
                <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                  <h4 className="text-sm font-medium mb-1">USCDI V3 Data Classes</h4>
                  <p className="text-xs text-muted-foreground">
                    Patient Demographics, Encounters, Conditions, Medications, Allergies, Procedures, Lab Results, Vital Signs, Immunizations, Clinical Notes, Diagnostic Reports
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5" /> Data Export
                </CardTitle>
                <CardDescription>Export FHIR resources for external consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Bulk Export</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Export all resources or filter by type. Returns a FHIR Bundle with all matching resources.
                  </p>
                  <code className="text-xs font-mono block p-2 bg-background rounded border">
                    GET /api/fhir/r4-export?_type=Patient,Condition
                  </code>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Patient-Level Export</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Export all data for a specific patient across all resource types. Ideal for data portability and patient access requests.
                  </p>
                  <code className="text-xs font-mono block p-2 bg-background rounded border">
                    POST /api/fhir/r4-export/patient?patient=ID
                  </code>
                </div>
                <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
                  <h4 className="text-sm font-medium mb-1">Compliance Standards</h4>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">FHIR R4</Badge>
                    <Badge variant="outline" className="text-xs">USCDI V3</Badge>
                    <Badge variant="outline" className="text-xs">HIPAA</Badge>
                    <Badge variant="outline" className="text-xs">SMART on FHIR</Badge>
                    <Badge variant="outline" className="text-xs">Bulk Data Access</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
