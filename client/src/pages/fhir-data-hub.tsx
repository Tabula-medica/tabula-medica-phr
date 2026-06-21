import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  Globe,
  Key,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface Partner {
  id: string;
  name: string;
  organization: string;
  contactEmail: string;
  apiKeyPrefix: string;
  status: "active" | "suspended" | "revoked";
  allowedScopes: string[];
  rateLimitPerHour: number;
  lastAccessAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ScopeDescription {
  scope: string;
  resource: string;
  permission: string;
  description: string;
  category: string;
}

interface ScopeGrant {
  id: string;
  patientUserId: string;
  partnerId: string;
  scope: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

interface AuditLog {
  id: string;
  partnerId: string | null;
  partnerName: string;
  action: string;
  resourceType: string | null;
  patientEmail: string | null;
  scopesUsed: string[];
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  requestPath: string;
  responseTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AuditStats {
  total: number;
  byPartner: Record<string, number>;
  byAction: Record<string, number>;
  byStatusCode: Record<string, number>;
}

export default function FhirDataHubPage() {
  useSEO({ title: "FHIR API Data Hub | Tabula Medica", description: "Manage API partners, OAuth scopes, and audit FHIR data access" });
  const [activeTab, setActiveTab] = useState("partners");
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const { toast } = useToast();

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Globe className="h-6 w-6 text-blue-600" aria-hidden="true" />
            FHIR API Data Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage authorized partner access, OAuth scopes, and audit all FHIR API data requests.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="partners" data-testid="tab-partners">
            <Key className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="scopes" data-testid="tab-scopes">
            <Shield className="h-4 w-4 mr-1.5" aria-hidden="true" />
            OAuth Scopes
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <ClipboardList className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="mt-4">
          <PartnersTab
            onAddPartner={() => setShowAddPartner(true)}
            onShowApiKey={setShowApiKey}
            onSelectPartner={setSelectedPartner}
          />
        </TabsContent>

        <TabsContent value="scopes" className="mt-4">
          <ScopesTab selectedPartner={selectedPartner} onSelectPartner={setSelectedPartner} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTab filter={auditFilter} onFilterChange={setAuditFilter} />
        </TabsContent>
      </Tabs>

      <AddPartnerDialog open={showAddPartner} onClose={() => setShowAddPartner(false)} onApiKeyGenerated={setShowApiKey} />
      <ApiKeyDialog apiKey={showApiKey} onClose={() => setShowApiKey(null)} />
    </div>
  );
}

function PartnersTab({ onAddPartner, onShowApiKey, onSelectPartner }: {
  onAddPartner: () => void;
  onShowApiKey: (key: string) => void;
  onSelectPartner: (id: string) => void;
}) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ partners: Partner[] }>({
    queryKey: ["/api/fhir-data-hub/partners"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/fhir-data-hub/partners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-hub/partners"] });
      toast({ title: "Partner removed" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/fhir-data-hub/partners/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-hub/partners"] });
      toast({ title: "Partner status updated" });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/fhir-data-hub/partners/${id}/rotate-key`),
    onSuccess: async (response) => {
      const data = await response.json();
      onShowApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-hub/partners"] });
      toast({ title: "API key rotated" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const partners = data?.partners || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Authorized API Partners</h2>
          <p className="text-sm text-muted-foreground">
            External organizations authorized to query patient FHIR bundles.
          </p>
        </div>
        <Button onClick={onAddPartner} data-testid="button-add-partner">
          <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Register Partner
        </Button>
      </div>

      {partners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium">No API Partners Registered</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Register an external partner organization to grant them authenticated FHIR API access.
            </p>
            <Button className="mt-4" onClick={onAddPartner} data-testid="button-add-partner-empty">
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Register First Partner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {partners.map(partner => (
            <Card key={partner.id} data-testid={`card-partner-${partner.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{partner.name}</CardTitle>
                      <CardDescription>{partner.organization} &middot; {partner.contactEmail}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={partner.status === "active" ? "default" : partner.status === "suspended" ? "secondary" : "destructive"}
                    data-testid={`badge-status-${partner.id}`}
                  >
                    {partner.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />}
                    {partner.status === "suspended" && <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />}
                    {partner.status === "revoked" && <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />}
                    {partner.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">API Key</span>
                    <p className="font-mono text-xs mt-0.5">{partner.apiKeyPrefix}••••••••</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate Limit</span>
                    <p className="mt-0.5">{partner.rateLimitPerHour}/hr</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scopes</span>
                    <p className="mt-0.5">{partner.allowedScopes.length} granted</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Access</span>
                    <p className="mt-0.5">{partner.lastAccessAt ? new Date(partner.lastAccessAt).toLocaleDateString() : "Never"}</p>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectPartner(partner.id)}
                    data-testid={`button-manage-scopes-${partner.id}`}
                    aria-label={`Manage scopes for ${partner.name}`}
                  >
                    <Shield className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Manage Scopes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rotateMutation.mutate(partner.id)}
                    disabled={rotateMutation.isPending}
                    data-testid={`button-rotate-key-${partner.id}`}
                    aria-label={`Rotate API key for ${partner.name}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Rotate Key
                  </Button>
                  {partner.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate({ id: partner.id, status: "suspended" })}
                      data-testid={`button-suspend-${partner.id}`}
                      aria-label={`Suspend ${partner.name}`}
                    >
                      <Lock className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Suspend
                    </Button>
                  ) : partner.status === "suspended" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => statusMutation.mutate({ id: partner.id, status: "active" })}
                      data-testid={`button-reactivate-${partner.id}`}
                      aria-label={`Reactivate ${partner.name}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Reactivate
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(partner.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${partner.id}`}
                    aria-label={`Delete ${partner.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopesTab({ selectedPartner, onSelectPartner }: {
  selectedPartner: string | null;
  onSelectPartner: (id: string) => void;
}) {
  const { toast } = useToast();

  const { data: partnersData } = useQuery<{ partners: Partner[] }>({
    queryKey: ["/api/fhir-data-hub/partners"],
  });

  const { data: scopesData } = useQuery<{ scopes: ScopeDescription[] }>({
    queryKey: ["/api/fhir-data-hub/available-scopes"],
  });

  const { data: grantsData, isLoading: grantsLoading } = useQuery<{ grants: ScopeGrant[] }>({
    queryKey: ["/api/fhir-data-hub/scope-grants/partner", selectedPartner],
    enabled: !!selectedPartner,
  });

  const updateMutation = useMutation({
    mutationFn: ({ partnerId, scopes }: { partnerId: string; scopes: { scope: string; granted: boolean }[] }) =>
      apiRequest("PUT", `/api/fhir-data-hub/scope-grants/partner/${partnerId}`, { scopes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-hub/scope-grants/partner", selectedPartner] });
      toast({ title: "Scope permissions updated" });
    },
  });

  const partners = partnersData?.partners || [];
  const availableScopes = scopesData?.scopes || [];
  const grants = grantsData?.grants || [];

  const grouped = availableScopes.reduce<Record<string, ScopeDescription[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const isScopeGranted = (scope: string) => grants.find(g => g.scope === scope)?.granted || false;

  const toggleScope = (scope: string) => {
    if (!selectedPartner) return;
    const current = isScopeGranted(scope);
    updateMutation.mutate({
      partnerId: selectedPartner,
      scopes: [{ scope, granted: !current }],
    });
  };

  const toggleAll = (granted: boolean) => {
    if (!selectedPartner) return;
    updateMutation.mutate({
      partnerId: selectedPartner,
      scopes: availableScopes.map(s => ({ scope: s.scope, granted })),
    });
  };

  const activePartner = partners.find(p => p.id === selectedPartner);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">OAuth Scopes Management</h2>
        <p className="text-sm text-muted-foreground">
          Control exactly what data each authorized partner can access. Scopes follow SMART on FHIR conventions.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="partner-select" className="whitespace-nowrap">Select Partner:</Label>
        <Select value={selectedPartner || ""} onValueChange={onSelectPartner}>
          <SelectTrigger className="w-72" id="partner-select" data-testid="select-partner-scopes">
            <SelectValue placeholder="Choose a partner..." />
          </SelectTrigger>
          <SelectContent>
            {partners.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} ({p.organization})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPartner ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium">Select a Partner</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a registered API partner above to manage their data access scopes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activePartner && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    <CardTitle className="text-base">{activePartner.name}</CardTitle>
                    <Badge variant={activePartner.status === "active" ? "default" : "secondary"}>
                      {activePartner.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAll(true)}
                      disabled={updateMutation.isPending}
                      data-testid="button-grant-all"
                      aria-label="Grant all scopes"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Grant All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAll(false)}
                      disabled={updateMutation.isPending}
                      data-testid="button-revoke-all"
                      aria-label="Revoke all scopes"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                      Revoke All
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {grantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            Object.entries(grouped).map(([category, scopes]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {scopes.map(scope => (
                    <div
                      key={scope.scope}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50"
                      data-testid={`scope-row-${scope.resource}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded flex items-center justify-center ${isScopeGranted(scope.scope) ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"}`}>
                          {isScopeGranted(scope.scope) ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{scope.resource}</p>
                          <p className="text-xs text-muted-foreground font-mono">{scope.scope}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isScopeGranted(scope.scope)}
                        onCheckedChange={() => toggleScope(scope.scope)}
                        disabled={updateMutation.isPending}
                        aria-label={`${isScopeGranted(scope.scope) ? "Revoke" : "Grant"} ${scope.resource} access`}
                        data-testid={`switch-scope-${scope.resource}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AuditTab({ filter, onFilterChange }: { filter: string; onFilterChange: (f: string) => void }) {
  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ["/api/fhir-data-hub/audit-logs"],
    refetchInterval: 15000,
  });

  const { data: statsData } = useQuery<AuditStats>({
    queryKey: ["/api/fhir-data-hub/audit-stats"],
    refetchInterval: 15000,
  });

  const logs = logsData?.logs || [];
  const stats = statsData;

  const filteredLogs = filter === "all" ? logs :
    filter === "errors" ? logs.filter(l => l.statusCode >= 400) :
    filter === "success" ? logs.filter(l => l.statusCode < 400) :
    logs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">HIPAA Audit Trail</h2>
          <p className="text-sm text-muted-foreground">
            Complete audit log of all FHIR API data requests for HIPAA compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500 animate-pulse" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Live — refreshes every 15s</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold" data-testid="text-total-requests">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Total API Requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-green-600" data-testid="text-success-count">
                {stats.byStatusCode["200"] || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Successful (200)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-auth-failures">
                {(stats.byStatusCode["401"] || 0) + (stats.byStatusCode["403"] || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Auth Failures</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-2xl font-bold" data-testid="text-partner-count">
                {Object.keys(stats.byPartner).length}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Active Partners</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-44" data-testid="select-audit-filter">
            <SelectValue placeholder="Filter logs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="success">Successful Only</SelectItem>
            <SelectItem value="errors">Errors Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium">No Audit Logs Yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              FHIR API requests from authorized partners will appear here with full HIPAA audit details.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{log.partnerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.patientEmail || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.statusCode < 400 ? "default" : log.statusCode < 500 ? "secondary" : "destructive"}
                        className="font-mono"
                      >
                        {log.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.responseTimeMs != null ? `${log.responseTimeMs}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.ipAddress || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

function AddPartnerDialog({ open, onClose, onApiKeyGenerated }: {
  open: boolean;
  onClose: () => void;
  onApiKeyGenerated: (key: string) => void;
}) {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [rateLimit, setRateLimit] = useState("100");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/fhir-data-hub/partners", body),
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-hub/partners"] });
      onApiKeyGenerated(data.apiKey);
      toast({ title: "Partner registered successfully" });
      setName("");
      setOrganization("");
      setContactEmail("");
      setRateLimit("100");
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to register partner", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !organization || !contactEmail) return;
    createMutation.mutate({
      name,
      organization,
      contactEmail,
      rateLimitPerHour: parseInt(rateLimit),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register API Partner</DialogTitle>
          <DialogDescription>
            Register an external organization to grant authenticated FHIR API access. An API key will be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="partner-name">Partner Name</Label>
            <Input
              id="partner-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., HealthBridge Analytics"
              required
              data-testid="input-partner-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-org">Organization</Label>
            <Input
              id="partner-org"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              placeholder="e.g., HealthBridge Inc."
              required
              data-testid="input-partner-org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-email">Contact Email</Label>
            <Input
              id="partner-email"
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="api@healthbridge.com"
              required
              data-testid="input-partner-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-limit">Rate Limit (requests/hour)</Label>
            <Input
              id="rate-limit"
              type="number"
              value={rateLimit}
              onChange={e => setRateLimit(e.target.value)}
              min="10"
              max="10000"
              data-testid="input-rate-limit"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-partner">
              {createMutation.isPending ? "Registering..." : "Register & Generate Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyDialog({ apiKey, onClose }: { apiKey: string | null; onClose: () => void }) {
  const { toast } = useToast();

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({ title: "API key copied to clipboard" });
    }
  };

  return (
    <Dialog open={!!apiKey} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-yellow-600" aria-hidden="true" />
            API Key Generated
          </DialogTitle>
          <DialogDescription>
            Copy this API key now. For security, it will not be shown again. Partners use this key as a Bearer token in the Authorization header.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This key grants access to patient health data. Store it securely and never expose it publicly.
            </p>
          </div>
          <div className="relative">
            <pre className="text-xs font-mono bg-muted p-3 rounded-lg break-all whitespace-pre-wrap" data-testid="text-api-key">
              {apiKey}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={copyToClipboard}
              aria-label="Copy API key to clipboard"
              data-testid="button-copy-key"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs font-medium mb-2">Usage Example:</p>
            <pre className="text-xs font-mono text-muted-foreground break-all whitespace-pre-wrap">
{`curl -H "Authorization: Bearer ${apiKey?.substring(0, 16)}..." \\
  "https://app.tabulamedica.health/api/fhir-data-hub/Patient?email=patient@example.com"`}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} data-testid="button-close-key-dialog">I've Saved the Key</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
