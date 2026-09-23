import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  Database,
  Play,
  Code,
  FileJson,
  Server,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Download,
  History,
  BookOpen,
  Zap,
  KeyRound,
  Lock,
  Unlock,
} from "lucide-react";

interface FHIREndpoint {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: string;
  vendor: string;
  status: "active" | "inactive" | "testing";
}

interface FHIRResourceProfile {
  resourceType: string;
  name: string;
  description: string;
  useCoreProfile: string;
  useCoreVersion: string;
  searchParameters: {
    name: string;
    type: string;
    description: string;
    expression: string;
    required?: boolean;
  }[];
  operations: {
    name: string;
    method: string;
    description: string;
    url: string;
  }[];
  elements: {
    path: string;
    name: string;
    type: string;
    cardinality: string;
    description: string;
    mustSupport: boolean;
  }[];
}

interface QueryResult {
  id: string;
  status: number;
  statusText: string;
  responseTime: number;
  body: unknown;
  resourceCount?: number;
  totalCount?: number;
  nextPageUrl?: string;
  prevPageUrl?: string;
  executedAt: string;
  error?: string;
}

interface OAuthClient {
  id: string;
  name: string;
  endpointId: string;
  authMethod: string;
  isActive: boolean;
  scopes: string[];
}

interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: {
    resourceType: string;
    method: string;
    endpoint: string;
    parameters: Record<string, string>;
  };
  tags: string[];
}

export function FHIRAPIExplorer() {
  const [activeTab, setActiveTab] = useState("resources");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [queryMethod, setQueryMethod] = useState<string>("GET");
  const [queryPath, setQueryPath] = useState<string>("");
  const [queryParams, setQueryParams] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [queryBody, setQueryBody] = useState<string>("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: metadata } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/fhir-explorer/metadata"],
  });

  const { data: endpointsData } = useQuery<{ endpoints: FHIREndpoint[] }>({
    queryKey: ["/api/fhir-explorer/endpoints"],
  });

  const { data: profilesData } = useQuery<{ profiles: FHIRResourceProfile[] }>({
    queryKey: ["/api/fhir-explorer/profiles"],
  });

  const { data: savedQueriesData } = useQuery<{ queries: SavedQuery[] }>({
    queryKey: ["/api/fhir-explorer/saved-queries"],
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<{ history: QueryResult[] }>({
    queryKey: ["/api/fhir-explorer/history"],
  });

  const { data: oauthClientsData } = useQuery<{ clients: OAuthClient[] }>({
    queryKey: ["/api/fhir-oauth/clients"],
  });

  const oauthClients = oauthClientsData?.clients || [];

  const executeMutation = useMutation({
    mutationFn: async (data: {
      endpointId: string;
      query: {
        resourceType: string;
        method: string;
        endpoint: string;
        parameters: Record<string, string>;
        body?: string;
      };
    }) => {
      return apiRequest("POST", "/api/fhir-explorer/execute", data);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      setQueryResult(result);
      refetchHistory();
      toast({ title: "Query executed successfully" });
    },
    onError: () => {
      toast({ title: "Query execution failed", variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch(`/api/fhir-explorer/endpoints/${endpointId}/test`);
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: result.success ? "Connection successful" : "Connection failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
  });

  const endpoints = endpointsData?.endpoints || [];
  const profiles = profilesData?.profiles || [];
  const savedQueries = savedQueriesData?.queries || [];
  const history = historyData?.history || [];

  const selectedProfile = profiles.find((p) => p.resourceType === selectedResource);

  const handleExecuteQuery = () => {
    if (!selectedEndpoint) {
      toast({ title: "Please select an endpoint", variant: "destructive" });
      return;
    }
    if (!queryPath) {
      toast({ title: "Please enter a query path", variant: "destructive" });
      return;
    }

    const params: Record<string, string> = {};
    queryParams.forEach(({ key, value }) => {
      if (key && value) params[key] = value;
    });

    executeMutation.mutate({
      endpointId: selectedEndpoint,
      query: {
        resourceType: selectedResource || "Unknown",
        method: queryMethod,
        endpoint: queryPath,
        parameters: params,
        body: queryBody || undefined,
      },
    });
  };

  const handleSelectOperation = (operation: { method: string; url: string }) => {
    setQueryMethod(operation.method);
    setQueryPath(operation.url);
    setActiveTab("query");
  };

  const handleAddParam = () => {
    setQueryParams([...queryParams, { key: "", value: "" }]);
  };

  const handleRemoveParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: "key" | "value", val: string) => {
    const updated = [...queryParams];
    updated[index][field] = val;
    setQueryParams(updated);
  };

  const toggleProfile = (resourceType: string) => {
    const newSet = new Set(expandedProfiles);
    if (newSet.has(resourceType)) {
      newSet.delete(resourceType);
    } else {
      newSet.add(resourceType);
    }
    setExpandedProfiles(newSet);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      testing: "secondary",
      inactive: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR API Explorer</h1>
          <p className="text-muted-foreground">
            Browse US Core profiles, construct queries, and test FHIR API connections
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{metadata?.fhirVersion as string}</Badge>
          <Badge variant="outline">US Core {metadata?.useCoreVersion as string}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resource-count">
              {profiles.length}
            </div>
            <p className="text-xs text-muted-foreground">US Core profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Endpoints</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-endpoint-count">
              {endpoints.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {endpoints.filter((e) => e.status === "active").length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Saved Queries</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-saved-count">
              {savedQueries.length}
            </div>
            <p className="text-xs text-muted-foreground">templates available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Query History</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-history-count">
              {history.length}
            </div>
            <p className="text-xs text-muted-foreground">recent executions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Database className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="endpoints" data-testid="tab-endpoints">
            <Server className="h-4 w-4 mr-2" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="query" data-testid="tab-query">
            <Code className="h-4 w-4 mr-2" />
            Query Builder
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            <FileJson className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>US Core FHIR Resources</CardTitle>
              <CardDescription>
                Browse available FHIR R4 resources with US Core profile definitions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {profiles.map((profile) => (
                    <Collapsible
                      key={profile.resourceType}
                      open={expandedProfiles.has(profile.resourceType)}
                      onOpenChange={() => toggleProfile(profile.resourceType)}
                    >
                      <Card className="hover-elevate" data-testid={`profile-${profile.resourceType}`}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                {expandedProfiles.has(profile.resourceType) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <div>
                                  <CardTitle className="text-base">{profile.resourceType}</CardTitle>
                                  <CardDescription className="text-xs">{profile.name}</CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">v{profile.useCoreVersion}</Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedResource(profile.resourceType);
                                    setQueryPath(`/${profile.resourceType}`);
                                    setActiveTab("query");
                                  }}
                                  data-testid={`btn-explore-${profile.resourceType}`}
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  Explore
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="space-y-4 pt-0">
                            <p className="text-sm text-muted-foreground">{profile.description}</p>

                            <div>
                              <h4 className="font-medium text-sm mb-2">Search Parameters</h4>
                              <div className="flex flex-wrap gap-1">
                                {profile.searchParameters.map((param) => (
                                  <Badge
                                    key={param.name}
                                    variant={param.required ? "default" : "secondary"}
                                    className="text-xs cursor-pointer"
                                    title={param.description}
                                    onClick={() => {
                                      setQueryParams([{ key: param.name, value: "" }]);
                                      setQueryPath(`/${profile.resourceType}`);
                                      setSelectedResource(profile.resourceType);
                                      setActiveTab("query");
                                    }}
                                  >
                                    {param.name}:{param.type}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-sm mb-2">Operations</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {profile.operations.map((op) => (
                                  <Button
                                    key={op.name}
                                    size="sm"
                                    variant="outline"
                                    className="justify-start"
                                    onClick={() => handleSelectOperation(op)}
                                    data-testid={`btn-op-${profile.resourceType}-${op.name}`}
                                  >
                                    <Badge variant="secondary" className="mr-2 text-xs">
                                      {op.method}
                                    </Badge>
                                    {op.name}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-sm mb-2">Must Support Elements</h4>
                              <div className="text-xs text-muted-foreground space-y-1">
                                {profile.elements.filter((e) => e.mustSupport).map((elem) => (
                                  <div key={elem.path} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{elem.cardinality}</Badge>
                                    <span className="font-mono">{elem.name}</span>
                                    <span className="text-muted-foreground">: {elem.type}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Server Endpoints</CardTitle>
              <CardDescription>Configure and test connections to external FHIR servers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpoints.map((endpoint) => (
                  <Card key={endpoint.id} className="hover-elevate" data-testid={`endpoint-${endpoint.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            <h3 className="font-semibold">{endpoint.name}</h3>
                            {getStatusBadge(endpoint.status)}
                            <Badge variant="outline">{endpoint.fhirVersion}</Badge>
                            <Badge variant="outline">{endpoint.vendor}</Badge>
                            {(() => {
                              const oauthClient = oauthClients.find(c => c.endpointId === endpoint.id);
                              if (oauthClient) {
                                return (
                                  <Badge variant={oauthClient.isActive ? "default" : "secondary"} className="flex items-center gap-1">
                                    {oauthClient.isActive ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                    {oauthClient.authMethod}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <p className="text-sm font-mono text-muted-foreground">{endpoint.baseUrl}</p>
                          {(() => {
                            const oauthClient = oauthClients.find(c => c.endpointId === endpoint.id);
                            if (oauthClient) {
                              return (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <KeyRound className="h-3 w-3" />
                                  <span>OAuth configured: {oauthClient.name}</span>
                                  <span className="text-muted-foreground">|</span>
                                  <span>Scopes: {oauthClient.scopes.slice(0, 3).join(", ")}{oauthClient.scopes.length > 3 ? "..." : ""}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <KeyRound className="h-3 w-3" />
                                <span>No OAuth configured</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testConnectionMutation.mutate(endpoint.id)}
                            disabled={testConnectionMutation.isPending}
                            data-testid={`btn-test-${endpoint.id}`}
                          >
                            {testConnectionMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4 mr-1" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEndpoint(endpoint.id);
                              setActiveTab("query");
                            }}
                            data-testid={`btn-use-${endpoint.id}`}
                          >
                            Use
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="query" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Query Builder</CardTitle>
                  <CardDescription>Construct and execute FHIR API queries</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fhir-api-explorer-endpoint">Endpoint</Label>
                      <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                        <SelectTrigger id="fhir-api-explorer-endpoint" data-testid="select-endpoint">
                          <SelectValue placeholder="Select endpoint" />
                        </SelectTrigger>
                        <SelectContent>
                          {endpoints.map((ep) => (
                            <SelectItem key={ep.id} value={ep.id}>
                              {ep.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fhir-api-explorer-resource-type">Resource Type</Label>
                      <Select value={selectedResource} onValueChange={setSelectedResource}>
                        <SelectTrigger id="fhir-api-explorer-resource-type" data-testid="select-resource">
                          <SelectValue placeholder="Select resource" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.resourceType} value={p.resourceType}>
                              {p.resourceType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-24">
                      <Label htmlFor="fhir-api-explorer-method">Method</Label>
                      <Select value={queryMethod} onValueChange={setQueryMethod}>
                        <SelectTrigger id="fhir-api-explorer-method" data-testid="select-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="fhir-api-explorer-path">Path</Label>
                      <Input id="fhir-api-explorer-path"
                        value={queryPath}
                        onChange={(e) => setQueryPath(e.target.value)}
                        placeholder="/Patient, /Observation?patient=123"
                        data-testid="input-path"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FieldCaption>Query Parameters</FieldCaption>
                      <Button size="sm" variant="outline" onClick={handleAddParam} data-testid="btn-add-param">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {queryParams.map((param, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Key"
                          value={param.key}
                          onChange={(e) => handleParamChange(index, "key", e.target.value)}
                          className="flex-1"
                          data-testid={`input-param-key-${index}`}
                        />
                        <Input
                          placeholder="Value"
                          value={param.value}
                          onChange={(e) => handleParamChange(index, "value", e.target.value)}
                          className="flex-1"
                          data-testid={`input-param-value-${index}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveParam(index)}
                          data-testid={`btn-remove-param-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {(queryMethod === "POST" || queryMethod === "PUT" || queryMethod === "PATCH") && (
                    <div className="space-y-2">
                      <Label htmlFor="fhir-api-explorer-request-body-json">Request Body (JSON)</Label>
                      <Textarea id="fhir-api-explorer-request-body-json"
                        value={queryBody}
                        onChange={(e) => setQueryBody(e.target.value)}
                        placeholder='{"resourceType": "Patient", ...}'
                        className="font-mono text-sm min-h-[150px]"
                        data-testid="input-body"
                      />
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleExecuteQuery}
                    disabled={executeMutation.isPending}
                    data-testid="btn-execute"
                  >
                    {executeMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Execute Query
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {savedQueries.map((sq) => (
                        <Button
                          key={sq.id}
                          variant="outline"
                          className="w-full justify-start text-left h-auto py-2"
                          onClick={() => {
                            setSelectedResource(sq.query.resourceType);
                            setQueryMethod(sq.query.method);
                            setQueryPath(sq.query.endpoint);
                            const params = Object.entries(sq.query.parameters).map(([key, value]) => ({
                              key,
                              value,
                            }));
                            setQueryParams(params.length ? params : [{ key: "", value: "" }]);
                          }}
                          data-testid={`btn-template-${sq.id}`}
                        >
                          <div>
                            <div className="font-medium">{sq.name}</div>
                            <div className="text-xs text-muted-foreground">{sq.description}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {selectedProfile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Available Parameters</CardTitle>
                    <CardDescription className="text-xs">{selectedProfile.resourceType}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {selectedProfile.searchParameters.map((param) => (
                          <div
                            key={param.name}
                            className="text-xs p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted"
                            {...clickable(() => {
                              if (!queryParams.find((p) => p.key === param.name)) {
                                setQueryParams([...queryParams, { key: param.name, value: "" }]);
                              }
                            })}
                            title={param.description}
                          >
                            <span className="font-mono font-medium">{param.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">{param.type}</Badge>
                            {param.required && <Badge className="ml-1 text-xs">required</Badge>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>View and analyze FHIR API response</CardDescription>
                </div>
                {queryResult && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(JSON.stringify(queryResult.body, null, 2))}
                      data-testid="btn-copy-result"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(queryResult.body, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `fhir-result-${queryResult.id}.json`;
                        a.click();
                      }}
                      data-testid="btn-download-result"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {queryResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    {queryResult.status >= 200 && queryResult.status < 300 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={queryResult.status < 400 ? "default" : "destructive"}>
                          {queryResult.status} {queryResult.statusText}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {queryResult.responseTime}ms
                        </span>
                        {queryResult.resourceCount !== undefined && (
                          <span className="text-sm text-muted-foreground">
                            {queryResult.resourceCount} resources
                            {queryResult.totalCount && ` of ${queryResult.totalCount} total`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(queryResult.nextPageUrl || queryResult.prevPageUrl) && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Pagination:</span>
                        {queryResult.totalCount && (
                          <Badge variant="outline">
                            {queryResult.resourceCount} of {queryResult.totalCount} resources
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!queryResult.prevPageUrl}
                          onClick={() => {
                            if (queryResult.prevPageUrl) {
                              toast({ title: "Previous page would load: " + queryResult.prevPageUrl });
                            }
                          }}
                          data-testid="btn-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!queryResult.nextPageUrl}
                          onClick={() => {
                            if (queryResult.nextPageUrl) {
                              toast({ title: "Next page would load: " + queryResult.nextPageUrl });
                            }
                          }}
                          data-testid="btn-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {queryResult.nextPageUrl && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded font-mono">
                      Next page URL: {queryResult.nextPageUrl}
                    </div>
                  )}

                  <ScrollArea className="h-[350px] border rounded-lg">
                    <pre className="p-4 text-sm font-mono" data-testid="text-result-json">
                      {JSON.stringify(queryResult.body, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results yet. Execute a query to see results here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Query History</CardTitle>
                  <CardDescription>Recent FHIR API query executions</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchHistory()}
                  data-testid="btn-refresh-history"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-muted ${
                        entry.error ? "bg-destructive/10" : "bg-muted/50"
                      }`}
                      {...clickable(() => setQueryResult(entry))}
                      data-testid={`history-${entry.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {entry.status >= 200 && entry.status < 300 ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <Badge variant={entry.status < 400 ? "secondary" : "destructive"}>
                            {entry.status}
                          </Badge>
                          <span className="text-sm font-mono">{entry.responseTime}ms</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.executedAt).toLocaleString()}
                        </span>
                      </div>
                      {entry.error && (
                        <p className="text-xs text-destructive mt-1">{entry.error}</p>
                      )}
                    </div>
                  ))}
                  {!history.length && (
                    <p className="text-center text-muted-foreground py-8">No query history yet</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
