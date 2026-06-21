import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Lock, 
  Key, 
  Users, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Eye,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Database,
  Server,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface SecurityMetrics {
  totalAuditLogs: number;
  phiAccessToday: number;
  failedAccessAttempts: number;
  activeUsers: number;
  mfaEnabledUsers: number;
  lastSecurityScan: string;
  encryptionStatus: "active" | "inactive" | "degraded";
  complianceScore: number;
}

interface RBACRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  riskLevel: "low" | "medium" | "high";
}

interface SecurityAlert {
  id: string;
  type: "warning" | "critical" | "info";
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  affectedResource?: string;
}

interface AuditLog {
  id: string;
  userId: string;
  userRole: string;
  patientId: string | null;
  resourceType: string;
  action: string;
  ipAddress: string;
  timestamp: string;
  status: string;
}

interface Permission {
  id: string;
  name: string;
  category: string;
  sensitivity: string;
}

interface EncryptionStatus {
  algorithm: string;
  keyLength: number;
  atRestEncryption: boolean;
  inTransitEncryption: boolean;
  keyRotationEnabled: boolean;
  lastKeyRotation: string;
  nextKeyRotation: string;
  encryptedFields: string[];
  status: string;
}

function MetricCard({ title, value, icon: Icon, trend, trendLabel }: { 
  title: string; 
  value: string | number; 
  icon: any;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trendLabel && (
          <p className={`text-xs ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
            {trendLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RoleCard({ role }: { role: RBACRole }) {
  const riskColors = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{role.name}</CardTitle>
          <Badge className={riskColors[role.riskLevel]} variant="outline">
            {role.riskLevel} risk
          </Badge>
        </div>
        <CardDescription>{role.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{role.userCount} users</span>
        </div>
        <div>
          <p className="text-xs font-medium mb-2">Permissions ({role.permissions.length})</p>
          <div className="flex flex-wrap gap-1">
            {role.permissions.slice(0, 4).map((perm) => (
              <Badge key={perm} variant="secondary" className="text-xs">
                {perm.replace(/_/g, " ")}
              </Badge>
            ))}
            {role.permissions.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{role.permissions.length - 4} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert }: { alert: SecurityAlert }) {
  const typeIcons = {
    info: CheckCircle,
    warning: AlertTriangle,
    critical: ShieldAlert,
  };
  const typeColors = {
    info: "text-blue-600",
    warning: "text-yellow-600",
    critical: "text-red-600",
  };
  const Icon = typeIcons[alert.type];

  return (
    <Card className={`hover-elevate ${!alert.resolved ? "border-l-4" : ""} ${
      alert.type === "critical" && !alert.resolved ? "border-l-red-500" :
      alert.type === "warning" && !alert.resolved ? "border-l-yellow-500" : ""
    }`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 mt-0.5 ${typeColors[alert.type]}`} />
            <div>
              <CardTitle className="text-sm font-medium">{alert.title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {new Date(alert.timestamp).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          <Badge variant={alert.resolved ? "secondary" : "outline"}>
            {alert.resolved ? "Resolved" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        {alert.affectedResource && (
          <Badge variant="outline" className="mt-2 text-xs">
            {alert.affectedResource}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogRow({ log }: { log: AuditLog }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-full ${log.status === "success" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
          {log.status === "success" ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {log.action.toUpperCase()} {log.resourceType}
          </p>
          <p className="text-xs text-muted-foreground">
            {log.userId} ({log.userRole})
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          {new Date(log.timestamp).toLocaleTimeString()}
        </p>
        <p className="text-xs text-muted-foreground">{log.ipAddress}</p>
      </div>
    </div>
  );
}

export default function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const metricsQuery = useQuery<{ success: boolean; data: SecurityMetrics }>({
    queryKey: ["/api/security/metrics"],
  });

  const rolesQuery = useQuery<{ success: boolean; data: RBACRole[] }>({
    queryKey: ["/api/security/rbac/roles"],
  });

  const permissionsQuery = useQuery<{ success: boolean; data: Permission[] }>({
    queryKey: ["/api/security/rbac/permissions"],
  });

  const alertsQuery = useQuery<{ success: boolean; data: SecurityAlert[] }>({
    queryKey: ["/api/security/alerts"],
  });

  const auditQuery = useQuery<{ success: boolean; data: { logs: AuditLog[]; totalCount: number } }>({
    queryKey: ["/api/security/audit-logs"],
  });

  const encryptionQuery = useQuery<{ success: boolean; data: EncryptionStatus }>({
    queryKey: ["/api/security/encryption-status"],
  });

  const complianceQuery = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/security/compliance-status"],
  });

  const metrics = metricsQuery.data?.data;
  const roles = rolesQuery.data?.data || [];
  const permissions = permissionsQuery.data?.data || [];
  const alerts = alertsQuery.data?.data || [];
  const auditLogs = auditQuery.data?.data?.logs || [];
  const encryption = encryptionQuery.data?.data;
  const compliance = complianceQuery.data?.data;

  const isLoading = metricsQuery.isLoading || rolesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (metricsQuery.isError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load security data</AlertTitle>
          <AlertDescription>
            Unable to retrieve security metrics. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => !a.resolved);
  const mfaPercentage = metrics ? Math.round((metrics.mfaEnabledUsers / metrics.activeUsers) * 100) : 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Security & Compliance Dashboard
          </h1>
          <p className="text-muted-foreground">
            HIPAA compliance monitoring, access control, and security audit
          </p>
        </div>
      </div>

      <Alert className="mb-6">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Security Status: {metrics?.encryptionStatus === "active" ? "Protected" : "Review Required"}</AlertTitle>
        <AlertDescription>
          {metrics?.encryptionStatus === "active" 
            ? "All security controls are active. End-to-end encryption is enabled for sensitive data."
            : "Some security controls may need attention. Review the status below."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Compliance Score"
          value={`${metrics?.complianceScore || 0}%`}
          icon={ShieldCheck}
          trend="up"
          trendLabel="HIPAA compliant"
        />
        <MetricCard
          title="PHI Access Today"
          value={metrics?.phiAccessToday || 0}
          icon={Eye}
          trend="neutral"
          trendLabel="All logged and audited"
        />
        <MetricCard
          title="Failed Access Attempts"
          value={metrics?.failedAccessAttempts || 0}
          icon={ShieldAlert}
          trend={metrics?.failedAccessAttempts && metrics.failedAccessAttempts > 10 ? "down" : "up"}
          trendLabel={metrics?.failedAccessAttempts && metrics.failedAccessAttempts > 10 ? "Elevated - investigate" : "Within normal range"}
        />
        <MetricCard
          title="MFA Coverage"
          value={`${mfaPercentage}%`}
          icon={UserCheck}
          trend={mfaPercentage > 80 ? "up" : "down"}
          trendLabel={`${metrics?.mfaEnabledUsers || 0} of ${metrics?.activeUsers || 0} users`}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="encryption" data-testid="tab-encryption">
            <Lock className="h-4 w-4 mr-2" />
            Encryption
          </TabsTrigger>
          <TabsTrigger value="rbac" data-testid="tab-rbac">
            <Users className="h-4 w-4 mr-2" />
            RBAC
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 text-xs">
                {activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {compliance?.certifications?.map((cert: any) => (
                  <div key={cert.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cert.status === "compliant" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium">{cert.name}</span>
                    </div>
                    <Badge variant={cert.status === "compliant" ? "default" : "secondary"}>
                      {cert.status === "compliant" ? "Compliant" : "In Progress"}
                    </Badge>
                  </div>
                ))}
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Last Assessment</span>
                    <span className="text-muted-foreground">
                      {compliance?.lastAssessment && new Date(compliance.lastAssessment).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Next Scheduled Audit</span>
                    <span className="text-muted-foreground">
                      {compliance?.nextScheduledAudit && new Date(compliance.nextScheduledAudit).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Security Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Encryption at Rest</span>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Encryption in Transit</span>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      TLS 1.2+
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Audit Logging</span>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">PHI Redaction</span>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  Last security scan: {metrics?.lastSecurityScan && new Date(metrics.lastSecurityScan).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Security Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 3).map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encryption" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Encryption Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Algorithm</p>
                    <p className="font-medium">{encryption?.algorithm || "AES-256-GCM"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Key Length</p>
                    <p className="font-medium">{encryption?.keyLength || 256} bits</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">At-Rest Encryption</span>
                    <Badge variant={encryption?.atRestEncryption ? "default" : "destructive"}>
                      {encryption?.atRestEncryption ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">In-Transit Encryption</span>
                    <Badge variant={encryption?.inTransitEncryption ? "default" : "destructive"}>
                      {encryption?.inTransitEncryption ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Key Rotation</span>
                    <Badge variant={encryption?.keyRotationEnabled ? "default" : "secondary"}>
                      {encryption?.keyRotationEnabled ? "Enabled" : "Manual"}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Key Rotation</span>
                    <span>{encryption?.lastKeyRotation && new Date(encryption.lastKeyRotation).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Scheduled Rotation</span>
                    <span>{encryption?.nextKeyRotation && new Date(encryption.nextKeyRotation).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Encrypted PHI Fields
                </CardTitle>
                <CardDescription>
                  All sensitive patient data is encrypted before storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {encryption?.encryptedFields?.map((field) => (
                    <Badge key={field} variant="secondary" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      {field}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rbac" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Role-Based Access Control</h2>
              <p className="text-sm text-muted-foreground">
                {roles.length} roles configured with granular permissions
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {permissions.length} permissions defined
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permission Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(new Set(permissions.map(p => p.category))).map((category) => {
                  const categoryPerms = permissions.filter(p => p.category === category);
                  return (
                    <div key={category} className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-2">{category}</h4>
                      <div className="flex flex-wrap gap-1">
                        {categoryPerms.map((perm) => (
                          <Badge 
                            key={perm.id} 
                            variant="outline" 
                            className={`text-xs ${
                              perm.sensitivity === "critical" ? "border-red-500 text-red-600" :
                              perm.sensitivity === "high" ? "border-yellow-500 text-yellow-600" :
                              ""
                            }`}
                          >
                            {perm.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Audit Log</h2>
              <p className="text-sm text-muted-foreground">
                {auditQuery.data?.data?.totalCount?.toLocaleString() || 0} total audit entries
              </p>
            </div>
            <Button variant="outline" size="sm" data-testid="button-export-audit">
              <FileText className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {auditLogs.map((log) => (
                  <AuditLogRow key={log.id} log={log} />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Security Alerts</h2>
              <p className="text-sm text-muted-foreground">
                {activeAlerts.length} active alerts requiring attention
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="destructive">{alerts.filter(a => a.type === "critical").length} Critical</Badge>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                {alerts.filter(a => a.type === "warning").length} Warning
              </Badge>
              <Badge variant="secondary">{alerts.filter(a => a.type === "info").length} Info</Badge>
            </div>
          </div>

          <div className="space-y-4">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
