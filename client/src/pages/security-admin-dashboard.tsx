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
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Laptop,
  Smartphone,
  Users,
  Building2,
  FileText,
  Download,
  Search,
  Lock,
  Key,
  Eye,
  ClipboardList,
  Activity,
  Clock,
  Server,
  AlertCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SecurityDashboardData {
  compliance: {
    encryption: { algorithm: string; keyLength: number; atRest: boolean; inTransit: boolean };
    logging: { phiRedaction: boolean; auditLogging: boolean };
    transport: { tlsMinVersion: string; hsts: boolean };
    hipaaCompliant: boolean;
  };
  soc2: {
    overallScore: number;
    controlsTotal: number;
    controlsCompliant: number;
    controlsDueForReview: number;
    recentReviews: number;
    openIncidents: number;
    pendingChanges: number;
  };
  tenants: {
    totalTenants: number;
    activeTenants: number;
    byTier: Record<string, number>;
  };
  sessions: {
    totalActiveSessions: number;
    totalUsers: number;
    expiredSessionsRemoved: number;
  };
  audit: {
    totalEvents: number;
    last24Hours: number;
    phiAccessCount: number;
    byRiskLevel: Record<string, number>;
  };
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  eventType: string;
  category: string;
  description: string;
  riskLevel: string;
  targetResourceType?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SOC2Control {
  controlId: string;
  name: string;
  description: string;
  category: string;
  status: string;
  lastReviewDate: string;
  nextReviewDue: string;
  riskLevel: string;
  evidenceTypes: string[];
  owner: string;
}

interface TenantInfo {
  id: string;
  name: string;
  domain?: string;
  tier: string;
  status: string;
  createdAt: string;
}

function SecurityScoreCard({ score, label }: { score: number; label: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-green-500";
    if (s >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (s: number) => {
    if (s >= 90) return "bg-green-500";
    if (s >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <Progress value={score} className={`mt-2 h-2 ${getProgressColor(score)}`} />
    </div>
  );
}

function ComplianceStatusCard({
  compliance,
  isLoading,
}: {
  compliance: SecurityDashboardData["compliance"] | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !compliance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const checks = [
    { label: "PHI Encryption (AES-256-GCM)", passed: compliance.encryption.atRest, icon: Lock },
    { label: "TLS 1.2+ Transport", passed: compliance.transport.tlsMinVersion === "1.2", icon: Key },
    { label: "PHI Safe Logging", passed: compliance.logging.phiRedaction, icon: Eye },
    { label: "Audit Trail Enabled", passed: compliance.logging.auditLogging, icon: ClipboardList },
    { label: "HSTS Enabled", passed: compliance.transport.hsts, icon: Shield },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          HIPAA Compliance Status
        </CardTitle>
        <CardDescription>
          Real-time compliance monitoring across security controls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Badge variant={compliance.hipaaCompliant ? "default" : "destructive"} className="text-sm py-1 px-3">
            {compliance.hipaaCompliant ? (
              <><ShieldCheck className="h-4 w-4 mr-1" /> HIPAA Compliant</>
            ) : (
              <><ShieldAlert className="h-4 w-4 mr-1" /> Review Required</>
            )}
          </Badge>
        </div>
        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <check.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{check.label}</span>
              </div>
              {check.passed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SOC2ControlsTab() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: { controls: SOC2Control[]; dueForReview: string[] } }>({
    queryKey: ["/api/security-admin/soc2/controls"],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error || !data?.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load SOC2 controls</AlertDescription>
      </Alert>
    );
  }

  const controls = data.data.controls || [];

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Control ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Risk Level</TableHead>
            <TableHead>Next Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((control) => (
            <TableRow key={control.controlId}>
              <TableCell className="font-mono text-xs">{control.controlId}</TableCell>
              <TableCell className="font-medium">{control.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{control.category}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={control.status === "compliant" ? "default" : control.status === "partial" ? "secondary" : "destructive"}>
                  {control.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={control.riskLevel === "high" ? "destructive" : control.riskLevel === "medium" ? "secondary" : "outline"}>
                  {control.riskLevel}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(control.nextReviewDue).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function AuditLogsTab() {
  const [eventType, setEventType] = useState<string>("");
  const [riskLevel, setRiskLevel] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (eventType && eventType !== "all") params.set("eventType", eventType);
    if (riskLevel && riskLevel !== "all") params.set("riskLevel", riskLevel);
    params.set("limit", "50");
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<{ success: boolean; data: { logs: AuditLogEntry[]; total: number } }>({
    queryKey: ["/api/security-admin/audit-logs", eventType, riskLevel],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/security-admin/audit-logs?${buildQueryString()}`);
      return res.json();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/security-admin/audit-logs/export?format=csv");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-logs.csv";
      a.click();
    },
  });

  const filteredLogs = (data?.data?.logs || []).filter(
    (log) => !searchQuery || log.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-audit-search"
          />
        </div>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-[180px]" data-testid="select-event-type">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="phi_access">PHI Access</SelectItem>
            <SelectItem value="share_link_created">Share Link</SelectItem>
            <SelectItem value="caregiver_added">Caregiver Added</SelectItem>
            <SelectItem value="record_export">Record Export</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={setRiskLevel}>
          <SelectTrigger className="w-[150px]" data-testid="select-risk-level">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-logs">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} data-testid="button-export-logs">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{log.eventType}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.userId?.slice(0, 8)}...</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.description}>
                    {log.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRiskBadgeVariant(log.riskLevel)} className="text-xs">
                      {log.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress || "—"}</TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

function TenantsTab() {
  const { data, isLoading } = useQuery<{ success: boolean; data: TenantInfo[] }>({
    queryKey: ["/api/security-admin/tenants"],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const tenants = data?.data || [];

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell className="font-mono text-xs">{tenant.id}</TableCell>
              <TableCell className="font-medium">{tenant.name}</TableCell>
              <TableCell className="text-muted-foreground">{tenant.domain || "—"}</TableCell>
              <TableCell>
                <Badge variant={tenant.tier === "white_glove" ? "default" : tenant.tier === "enterprise" ? "secondary" : "outline"}>
                  {tenant.tier}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                  {tenant.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(tenant.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
          {tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No tenants configured
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function DeviceSessionsTab() {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <Alert>
        <Laptop className="h-4 w-4" />
        <AlertDescription>
          Device session management allows tracking and controlling user access across multiple devices.
          Users can view their active sessions and revoke access from untrusted devices.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Laptop className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">15-min</p>
                <p className="text-sm text-muted-foreground">Access Token TTL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Key className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">7 days</p>
                <p className="text-sm text-muted-foreground">Refresh Token TTL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Smartphone className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">10</p>
                <p className="text-sm text-muted-foreground">Max Sessions/User</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Security Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Device Fingerprinting", description: "Track unique device identifiers for session binding" },
              { label: "Token Rotation", description: "Rotate refresh tokens on each use to detect replay attacks" },
              { label: "Automatic Cleanup", description: "Expired sessions are automatically removed" },
              { label: "Revoke All Sessions", description: "Users can logout from all devices at once" },
              { label: "Session Limit Enforcement", description: "Oldest session removed when limit exceeded" },
            ].map((feature) => (
              <div key={feature.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">{feature.label}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SecurityAdminDashboard() {
  useSEO({
    title: "Security Admin Dashboard | Tabula Medica",
    description: "Enterprise security administration with SOC2 compliance tracking, audit logs, device sessions, and tenant management",
  });

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboardData, isLoading, error, refetch } = useQuery<{ success: boolean; data: SecurityDashboardData }>({
    queryKey: ["/api/security-admin/dashboard"],
    refetchInterval: 60000,
  });

  const verifyIntegrityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/security-admin/audit-logs/verify");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.data?.valid) {
        toast({
          title: "Audit Integrity Verified",
          description: `All ${data.data.totalLogs} logs passed integrity check`,
        });
      } else {
        toast({
          title: "Integrity Check Failed",
          description: "Some logs may have been tampered with",
          variant: "destructive",
        });
      }
    },
  });

  const dashboard = dashboardData?.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin-analytics">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Security Admin Dashboard
              </h1>
              <p className="text-muted-foreground">
                SOC2 compliance, audit trails, device sessions, and tenant management
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => verifyIntegrityMutation.mutate()} disabled={verifyIntegrityMutation.isPending} data-testid="button-verify-integrity">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify Audit Integrity
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load security dashboard data</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "—" : `${dashboard?.soc2?.overallScore || 0}%`}
                    </p>
                    <p className="text-sm text-muted-foreground">SOC2 Score</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "—" : dashboard?.audit?.last24Hours || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Events (24h)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "—" : dashboard?.sessions?.totalActiveSessions || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Active Sessions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {isLoading ? "—" : dashboard?.tenants?.activeTenants || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Active Tenants</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Shield className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <FileText className="h-4 w-4 mr-2" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="soc2" data-testid="tab-soc2">
              <ClipboardList className="h-4 w-4 mr-2" />
              SOC2 Controls
            </TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">
              <Laptop className="h-4 w-4 mr-2" />
              Device Sessions
            </TabsTrigger>
            <TabsTrigger value="tenants" data-testid="tab-tenants">
              <Building2 className="h-4 w-4 mr-2" />
              Tenants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ComplianceStatusCard compliance={dashboard?.compliance} isLoading={isLoading} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Audit Summary
                  </CardTitle>
                  <CardDescription>Recent security events by risk level</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="space-y-4">
                      {["critical", "high", "medium", "low"].map((level) => {
                        const count = dashboard?.audit?.byRiskLevel?.[level] || 0;
                        const total = dashboard?.audit?.totalEvents || 1;
                        const percentage = Math.round((count / total) * 100);
                        return (
                          <div key={level} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{level} Risk</span>
                              <span className="text-muted-foreground">{count} events</span>
                            </div>
                            <Progress
                              value={percentage}
                              className={`h-2 ${level === "critical" || level === "high" ? "[&>div]:bg-red-500" : level === "medium" ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Tenant Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(dashboard?.tenants?.byTier || {}).map(([tier, count]) => (
                        <div key={tier} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Badge variant={tier === "white_glove" ? "default" : tier === "enterprise" ? "secondary" : "outline"}>
                              {tier.replace("_", " ")}
                            </Badge>
                          </div>
                          <span className="text-lg font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    SOC2 Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-3xl font-bold text-green-500">
                          {dashboard?.soc2?.controlsCompliant || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Compliant Controls</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-3xl font-bold text-amber-500">
                          {dashboard?.soc2?.controlsDueForReview || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Due for Review</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-3xl font-bold">
                          {dashboard?.soc2?.openIncidents || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Open Incidents</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-3xl font-bold">
                          {dashboard?.soc2?.pendingChanges || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Pending Changes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Event Log</CardTitle>
                <CardDescription>
                  Immutable, hash-chained audit logs for HIPAA and SOC2 compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AuditLogsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="soc2" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>SOC2 Control Framework</CardTitle>
                <CardDescription>
                  Trust Service Criteria controls with review status and evidence tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SOC2ControlsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
            <DeviceSessionsTab />
          </TabsContent>

          <TabsContent value="tenants" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Tenant Management</CardTitle>
                <CardDescription>
                  Tenant isolation with tier-based feature gates and security policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TenantsTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
