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
  Shield,
  Users,
  Key,
  Lock,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  ShieldCheck,
  KeyRound,
  Activity,
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  scope: string;
}

interface OAuthClient {
  id: string;
  name: string;
  description: string;
  endpointId: string;
  authMethod: string;
  grantType: string;
  clientId: string;
  scopes: string[];
  tokenLifetime: number;
  refreshTokenEnabled: boolean;
  pkceEnabled: boolean;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  resource: string;
  resourceCategory: string;
  action: string;
  decision: string;
  reason: string;
}

interface OAuthAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  clientConfigId: string;
  userId?: string;
  success: boolean;
  scopes?: string[];
  errorCode?: string;
}

export function FHIRAccessControlDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: rbacMetadata } = useQuery<{ roles: number; permissions: number }>({
    queryKey: ["/api/rbac/metadata"],
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ["/api/rbac/permissions"],
  });

  const { data: oauthClients } = useQuery<OAuthClient[]>({
    queryKey: ["/api/fhir-oauth/clients"],
  });

  const { data: oauthStats } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/fhir-oauth/statistics"],
  });

  const { data: accessAudit } = useQuery<AuditEntry[]>({
    queryKey: ["/api/rbac/audit-logs"],
  });

  const { data: oauthAudit } = useQuery<OAuthAuditEntry[]>({
    queryKey: ["/api/fhir-oauth/audit"],
  });

  const toggleClientMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/fhir-oauth/clients/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-oauth/clients"] });
      toast({ title: "OAuth client updated" });
    },
  });

  const filteredPermissions = permissions?.filter(p => 
    searchQuery === "" || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.resource.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fhirPermissions = permissions?.filter(p => p.resource.startsWith("fhir_"));

  const getResourceBadge = (resource: string) => {
    const colors: Record<string, string> = {
      fhir_resources: "bg-blue-500",
      fhir_mappings: "bg-purple-500",
      fhir_rules: "bg-amber-500",
      fhir_sync: "bg-green-500",
      fhir_endpoints: "bg-cyan-500",
      patient_records: "bg-red-500",
      data_sources: "bg-indigo-500",
    };
    return <Badge className={colors[resource] || ""}>{resource.replace(/_/g, " ")}</Badge>;
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      create: "default",
      read: "secondary",
      update: "outline",
      delete: "destructive",
      execute: "default",
      configure: "outline",
      approve: "default",
      export: "secondary",
    };
    return <Badge variant={variants[action] || "outline"}>{action}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Access Control</h1>
          <p className="text-muted-foreground">
            Granular role-based access control and OAuth 2.0/OIDC authentication
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/rbac"] });
              queryClient.invalidateQueries({ queryKey: ["/api/fhir-oauth"] });
            }}
            data-testid="btn-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-roles-count">
              {roles?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {roles?.filter(r => r.isActive).length || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-permissions-count">
              {permissions?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {fhirPermissions?.length || 0} FHIR-specific
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">OAuth Clients</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-oauth-clients">
              {(oauthStats?.totalClientConfigs as number) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(oauthStats?.activeClientConfigs as number) || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-tokens">
              {(oauthStats?.activeTokens as number) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(oauthStats?.revokedTokens as number) || 0} revoked
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Shield className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">
            <Users className="h-4 w-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <Key className="h-4 w-4 mr-2" />
            FHIR Permissions
          </TabsTrigger>
          <TabsTrigger value="oauth" data-testid="tab-oauth">
            <KeyRound className="h-4 w-4 mr-2" />
            OAuth Clients
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Access Control Features</CardTitle>
                <CardDescription>Granular RBAC for FHIR resources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Users, title: "Role-Based Access", desc: "Admin, Clinician, Patient, Caregiver, Auditor roles" },
                  { icon: Key, title: "FHIR Permissions", desc: "Resources, mappings, rules, sync, endpoints" },
                  { icon: Lock, title: "OAuth 2.0/OIDC", desc: "Secure external FHIR server authentication" },
                  { icon: ShieldCheck, title: "SMART on FHIR", desc: "App launch with PKCE and scoped access" },
                  { icon: FileText, title: "Audit Logging", desc: "HIPAA-compliant access and modification tracking" },
                ].map(item => (
                  <div key={item.title} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <item.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Access Activity</CardTitle>
                <CardDescription>Latest access control decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {accessAudit?.slice(0, 5).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {entry.decision === "allowed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{entry.userId}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.action} on {entry.resource}
                            </p>
                          </div>
                        </div>
                        <Badge variant={entry.decision === "allowed" ? "default" : "destructive"}>
                          {entry.decision}
                        </Badge>
                      </div>
                    ))}
                    {!accessAudit?.length && (
                      <p className="text-center text-muted-foreground py-8">No recent activity</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Roles</CardTitle>
              <CardDescription>Predefined roles with FHIR resource permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles?.map(role => {
                  const fhirPerms = role.permissions.filter(p => p.startsWith("fhir_"));
                  return (
                    <Card key={role.id} className="hover-elevate" data-testid={`role-${role.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              <h3 className="font-semibold">{role.displayName}</h3>
                              <Badge variant={role.isActive ? "default" : "secondary"}>
                                {role.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {role.isSystem && <Badge variant="outline">System</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{role.permissions.length} total permissions</span>
                              <span>|</span>
                              <span>{fhirPerms.length} FHIR permissions</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {fhirPerms.slice(0, 6).map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                              {fhirPerms.length > 6 && (
                                <Badge variant="secondary" className="text-xs">+{fhirPerms.length - 6} more</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" data-testid={`btn-view-${role.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>FHIR Permissions</CardTitle>
                  <CardDescription>Granular permissions for FHIR resources and operations</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search permissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-permissions"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {(searchQuery ? filteredPermissions : fhirPermissions)?.map(permission => (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`permission-${permission.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getResourceBadge(permission.resource)}
                        {getActionBadge(permission.action)}
                        <Badge variant="outline">{permission.scope}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oauth" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>OAuth 2.0/OIDC Clients</CardTitle>
                  <CardDescription>External FHIR server authentication configurations</CardDescription>
                </div>
                <Button data-testid="btn-add-oauth-client">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {oauthClients?.map(client => (
                  <Card key={client.id} className="hover-elevate" data-testid={`oauth-${client.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            <h3 className="font-semibold">{client.name}</h3>
                            <Badge variant={client.isActive ? "default" : "secondary"}>
                              {client.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">{client.authMethod}</Badge>
                            <Badge variant="outline">{client.grantType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{client.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Client ID: {client.clientId}</span>
                            <span>Token lifetime: {client.tokenLifetime}s</span>
                            {client.pkceEnabled && <Badge variant="outline" className="text-xs">PKCE</Badge>}
                            {client.refreshTokenEnabled && <Badge variant="outline" className="text-xs">Refresh</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {client.scopes.slice(0, 4).map(scope => (
                              <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                            ))}
                            {client.scopes.length > 4 && (
                              <Badge variant="secondary" className="text-xs">+{client.scopes.length - 4} more</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={client.isActive}
                            onCheckedChange={(checked) =>
                              toggleClientMutation.mutate({ id: client.id, isActive: checked })
                            }
                            data-testid={`switch-oauth-${client.id}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!oauthClients?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No OAuth clients configured</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Access Control Audit</CardTitle>
                <CardDescription>RBAC access decisions and user actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {accessAudit?.map(entry => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg text-sm ${
                          entry.decision === "denied" ? "bg-destructive/10" : "bg-muted/50"
                        }`}
                        data-testid={`audit-${entry.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {entry.decision === "allowed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium">{entry.userId}</span>
                            <Badge variant="outline" className="text-xs">{entry.userRole}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entry.action} on {entry.resource} - {entry.reason}
                        </p>
                      </div>
                    ))}
                    {!accessAudit?.length && (
                      <p className="text-center text-muted-foreground py-8">No audit entries</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>OAuth Activity</CardTitle>
                <CardDescription>Token issuance, refresh, and revocation</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {oauthAudit?.map(entry => (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-lg text-sm ${
                          !entry.success ? "bg-destructive/10" : "bg-muted/50"
                        }`}
                        data-testid={`oauth-audit-${entry.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {entry.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <Badge variant="outline">{entry.action}</Badge>
                            {entry.userId && <span className="text-xs">{entry.userId}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {entry.scopes && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.scopes.slice(0, 3).map(scope => (
                              <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.errorCode && (
                          <p className="text-xs text-destructive mt-1">Error: {entry.errorCode}</p>
                        )}
                      </div>
                    ))}
                    {!oauthAudit?.length && (
                      <p className="text-center text-muted-foreground py-8">No OAuth activity</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
