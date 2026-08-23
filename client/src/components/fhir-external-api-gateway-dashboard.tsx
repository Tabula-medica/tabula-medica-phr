import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Shield,
  FileCode,
  Activity,
  Plus,
  Settings,
  Globe,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Database,
  Lock,
  Zap,
  Copy,
} from "lucide-react";

interface APIGatewayClient {
  id: string;
  name: string;
  description: string;
  clientId: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedResourceTypes: string[];
  fhirVersions: ("R4" | "R5")[];
  isActive: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  customProfiles?: string[];
  createdAt: string;
  updatedAt: string;
}

interface CustomProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  fhirVersion: "R4" | "R5";
  resourceType: string;
  constraints: Array<{
    id: string;
    path: string;
    severity: "error" | "warning";
    human: string;
  }>;
  extensions: Array<{
    url: string;
    path: string;
    valueType: string;
    isRequired: boolean;
  }>;
  isActive: boolean;
}

interface GatewayStatistics {
  totalClients: number;
  activeClients: number;
  totalProfiles: number;
  resourceTypes: number;
  rateLimitStatus: Array<{
    clientId: string;
    minute: number;
    hour: number;
    day: number;
  }>;
}

export function FHIRExternalAPIGatewayDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const { toast } = useToast();

  const { data: statistics, isLoading: statsLoading } = useQuery<GatewayStatistics>({
    queryKey: ["/api/fhir-external-gateway/statistics"],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<APIGatewayClient[]>({
    queryKey: ["/api/fhir-external-gateway/clients"],
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<CustomProfile[]>({
    queryKey: ["/api/fhir-external-gateway/profiles"],
  });

  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ["/api/fhir-external-gateway/resource-types"],
  });

  const toggleClientMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/fhir-external-gateway/clients/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-external-gateway/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-external-gateway/statistics"] });
      toast({ title: "Client updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR External API Gateway</h1>
          <p className="text-muted-foreground">
            Manage external system access to FHIR resources with OAuth scopes and RBAC
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/fhir-external-gateway"] });
            }}
            data-testid="btn-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-create-client">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <CreateClientDialog onClose={() => setIsCreateClientOpen(false)} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clients">
              {statsLoading ? "..." : statistics?.totalClients || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.activeClients || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Custom Profiles</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-profiles">
              {statsLoading ? "..." : statistics?.totalProfiles || 0}
            </div>
            <p className="text-xs text-muted-foreground">FHIR validation profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Resource Types</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resource-types">
              {statsLoading ? "..." : statistics?.resourceTypes || 0}
            </div>
            <p className="text-xs text-muted-foreground">Supported FHIR resources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">FHIR Versions</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="default">R4</Badge>
              <Badge variant="secondary">R5</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Supported versions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="clients" data-testid="tab-clients">
            <Users className="h-4 w-4 mr-2" />
            API Clients
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileCode className="h-4 w-4 mr-2" />
            Custom Profiles
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Database className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Gateway Endpoints
                </CardTitle>
                <CardDescription>Available API endpoints for external systems</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <code className="text-sm font-mono">/api/fhir-external-gateway/r4/metadata</code>
                      <p className="text-xs text-muted-foreground mt-1">Capability Statement (R4)</p>
                    </div>
                    <Badge variant="outline">GET</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <code className="text-sm font-mono">/api/fhir-external-gateway/r5/metadata</code>
                      <p className="text-xs text-muted-foreground mt-1">Capability Statement (R5)</p>
                    </div>
                    <Badge variant="outline">GET</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <code className="text-sm font-mono">/api/fhir-external-gateway/r4/:resourceType</code>
                      <p className="text-xs text-muted-foreground mt-1">CRUD operations for R4 resources</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">GET</Badge>
                      <Badge variant="outline">POST</Badge>
                      <Badge variant="outline">PUT</Badge>
                      <Badge variant="outline">DELETE</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Features
                </CardTitle>
                <CardDescription>Authentication and authorization capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">OAuth 2.0 Scopes</p>
                      <p className="text-xs text-muted-foreground">Fine-grained access control via scopes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">RBAC Integration</p>
                      <p className="text-xs text-muted-foreground">Role-based permission enforcement</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Rate Limiting</p>
                      <p className="text-xs text-muted-foreground">Per-client request throttling</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Audit Logging</p>
                      <p className="text-xs text-muted-foreground">Comprehensive request/response logging</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Supported OAuth Scopes
              </CardTitle>
              <CardDescription>SMART on FHIR compatible scope definitions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { scope: "patient/*.read", desc: "Read all patient data" },
                  { scope: "patient/*.write", desc: "Write all patient data" },
                  { scope: "user/*.read", desc: "Read data user has access to" },
                  { scope: "user/*.write", desc: "Write data user has access to" },
                  { scope: "system/*.read", desc: "Backend service read access" },
                  { scope: "system/*.write", desc: "Backend service write access" },
                  { scope: "launch/patient", desc: "Patient context launch" },
                  { scope: "openid", desc: "OpenID Connect scope" },
                  { scope: "fhirUser", desc: "FHIR user identity" },
                ].map(item => (
                  <div key={item.scope} className="p-3 bg-muted/50 rounded-lg">
                    <code className="text-sm font-mono">{item.scope}</code>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered API Clients</CardTitle>
              <CardDescription>External systems authorized to access FHIR resources</CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !clients?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API clients registered</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsCreateClientOpen(true)}
                    data-testid="btn-add-first-client"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Client
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {clients.map(client => (
                      <Card key={client.id} className="hover-elevate" data-testid={`client-${client.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{client.name}</h3>
                                <Badge variant={client.isActive ? "default" : "secondary"}>
                                  {client.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{client.description}</p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded">{client.clientId}</code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(client.clientId)}
                                  data-testid={`btn-copy-${client.id}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {client.fhirVersions.map(v => (
                                  <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                                ))}
                                {client.allowedScopes.slice(0, 3).map(scope => (
                                  <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                                ))}
                                {client.allowedScopes.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{client.allowedScopes.length - 3} more
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Rate limits: {client.rateLimits.requestsPerMinute}/min, {client.rateLimits.requestsPerHour}/hr
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={client.isActive}
                                onCheckedChange={(checked) =>
                                  toggleClientMutation.mutate({ id: client.id, isActive: checked })
                                }
                                data-testid={`switch-${client.id}`}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom FHIR Profiles</CardTitle>
              <CardDescription>Validation profiles for resource conformance checking</CardDescription>
            </CardHeader>
            <CardContent>
              {profilesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !profiles?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No custom profiles defined</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profiles.map(profile => (
                    <Card key={profile.id} className="hover-elevate" data-testid={`profile-${profile.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{profile.name}</h3>
                              <Badge variant="outline">{profile.fhirVersion}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Resource: {profile.resourceType}
                            </p>
                            <code className="text-xs text-muted-foreground block mt-1 truncate">
                              {profile.url}
                            </code>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {profile.constraints.length} constraints
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {profile.extensions.length} extensions
                              </Badge>
                            </div>
                          </div>
                          <Badge variant={profile.isActive ? "default" : "secondary"}>
                            {profile.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported FHIR Resources</CardTitle>
              <CardDescription>Resource types available through the API gateway</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {resourceTypes?.map(type => (
                  <div
                    key={type}
                    className="p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer"
                    data-testid={`resource-${type}`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{type}</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">CRUD</Badge>
                      <Badge variant="outline" className="text-xs">Search</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Authorization Flow
                </CardTitle>
                <CardDescription>How external systems authenticate and authorize</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</div>
                    <div>
                      <p className="font-medium">Client Registration</p>
                      <p className="text-sm text-muted-foreground">Register client with allowed scopes and resource types</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</div>
                    <div>
                      <p className="font-medium">OAuth Token Request</p>
                      <p className="text-sm text-muted-foreground">Client obtains access token with requested scopes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</div>
                    <div>
                      <p className="font-medium">Scope Validation</p>
                      <p className="text-sm text-muted-foreground">Gateway validates scopes match requested operation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</div>
                    <div>
                      <p className="font-medium">RBAC Check</p>
                      <p className="text-sm text-muted-foreground">User role permissions verified against resource/action</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">5</div>
                    <div>
                      <p className="font-medium">Audit Logging</p>
                      <p className="text-sm text-muted-foreground">All requests logged for compliance and monitoring</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Rate Limiting
                </CardTitle>
                <CardDescription>Request throttling configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statistics?.rateLimitStatus?.length ? (
                    statistics.rateLimitStatus.map(status => (
                      <div key={status.clientId} className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-medium text-sm">{status.clientId}</p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Minute</p>
                            <p className="font-medium">{status.minute}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Hour</p>
                            <p className="font-medium">{status.hour}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Day</p>
                            <p className="font-medium">{status.day}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No rate limit data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                HIPAA Compliance Features
              </CardTitle>
              <CardDescription>Built-in compliance and security measures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { feature: "PHI Access Logging", status: "enabled", desc: "All PHI access is logged" },
                  { feature: "Encryption in Transit", status: "enabled", desc: "TLS 1.2+ required" },
                  { feature: "Access Reason Tracking", status: "enabled", desc: "Reason for access recorded" },
                  { feature: "Session Management", status: "enabled", desc: "Token expiry and refresh" },
                  { feature: "IP Filtering", status: "available", desc: "Whitelist/blacklist support" },
                  { feature: "Consent Verification", status: "available", desc: "Patient consent checks" },
                ].map(item => (
                  <div key={item.feature} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {item.status === "enabled" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium text-sm">{item.feature}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
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

function CreateClientDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    clientId: "",
    clientSecret: "",
    redirectUris: [""],
    allowedScopes: ["patient/*.read"],
    allowedResourceTypes: ["Patient", "Observation"],
    fhirVersions: ["R4"] as ("R4" | "R5")[],
    isActive: true,
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/fhir-external-gateway/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-external-gateway/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-external-gateway/statistics"] });
      toast({ title: "Client created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Register New API Client</DialogTitle>
        <DialogDescription>
          Create credentials for an external system to access the FHIR API
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="EHR Integration"
              required
              data-testid="input-client-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              placeholder="my-app-client"
              required
              data-testid="input-client-id"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Integration for patient data exchange"
            data-testid="input-description"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret</Label>
          <Input
            id="clientSecret"
            type="password"
            value={formData.clientSecret}
            onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
            data-testid="input-client-secret"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="redirectUri">Redirect URI</Label>
          <Input
            id="redirectUri"
            value={formData.redirectUris[0]}
            onChange={(e) => setFormData({ ...formData, redirectUris: [e.target.value] })}
            placeholder="https://example.com/callback"
            required
            data-testid="input-redirect-uri"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fhir-external-api-gatewa-fhir-versions">FHIR Versions</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input id="fhir-external-api-gatewa-fhir-versions"
                  type="checkbox"
                  checked={formData.fhirVersions.includes("R4")}
                  onChange={(e) => {
                    const versions = e.target.checked
                      ? [...formData.fhirVersions, "R4"]
                      : formData.fhirVersions.filter((v) => v !== "R4");
                    setFormData({ ...formData, fhirVersions: versions as ("R4" | "R5")[] });
                  }}
                />
                R4
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.fhirVersions.includes("R5")}
                  onChange={(e) => {
                    const versions = e.target.checked
                      ? [...formData.fhirVersions, "R5"]
                      : formData.fhirVersions.filter((v) => v !== "R5");
                    setFormData({ ...formData, fhirVersions: versions as ("R4" | "R5")[] });
                  }}
                />
                R5
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fhir-external-api-gatewa-rate-limits-per-minute">Rate Limits (per minute)</Label>
            <Input id="fhir-external-api-gatewa-rate-limits-per-minute"
              type="number"
              value={formData.rateLimits.requestsPerMinute}
              onChange={(e) => setFormData({
                ...formData,
                rateLimits: { ...formData.rateLimits, requestsPerMinute: parseInt(e.target.value) }
              })}
              min={1}
              max={1000}
              data-testid="input-rate-limit"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-client">
            {createMutation.isPending ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
