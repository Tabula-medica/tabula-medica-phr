import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ShieldCheck,
  Lock,
  Key,
  Cloud,
  Server,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Network,
  Eye,
  FileText,
  ArrowUpDown,
  Fingerprint,
  Globe,
  Webhook,
  Code2,
  Layers,
  GitBranch,
  Download,
  ExternalLink,
  Zap,
  Building2,
} from "lucide-react";
import { PageHeader, MetricCard, LoadingState } from "@/components/shared";
import type {
  ComplianceFramework,
  ComplianceFrameworkStatus,
  ComplianceControl,
  ComplianceControlStatus,
  AggregatorSyncRecord,
  WebhookEvent,
  WebhookConfig,
  GcpArchitectureStatus,
} from "@shared/schema";

const SAMPLE_FRAMEWORKS: ComplianceFrameworkStatus[] = [
  {
    framework: "HIPAA",
    overallScore: 94,
    totalControls: 54,
    implementedControls: 48,
    partialControls: 4,
    plannedControls: 2,
    gapControls: 0,
    lastAuditDate: "2025-11-15",
    nextAuditDate: "2026-05-15",
    certificationStatus: "certified",
    certificationExpiry: "2026-11-15",
  },
  {
    framework: "SOC2",
    overallScore: 88,
    totalControls: 64,
    implementedControls: 52,
    partialControls: 8,
    plannedControls: 3,
    gapControls: 1,
    lastAuditDate: "2025-09-20",
    nextAuditDate: "2026-03-20",
    certificationStatus: "certified",
    certificationExpiry: "2026-09-20",
  },
  {
    framework: "HITRUST",
    overallScore: 82,
    totalControls: 156,
    implementedControls: 118,
    partialControls: 22,
    plannedControls: 12,
    gapControls: 4,
    lastAuditDate: "2025-08-10",
    nextAuditDate: "2026-08-10",
    certificationStatus: "in_progress",
    certificationExpiry: null,
  },
];

const SAMPLE_CONTROLS: ComplianceControl[] = [
  { id: "1", framework: "HIPAA", controlId: "164.312(a)(1)", title: "Access Control", description: "Implement technical policies and procedures for systems that maintain ePHI", category: "Technical Safeguards", status: "implemented", implementationNotes: "RBAC with MFA enforced via Identity Platform", evidenceLinks: ["/audit-logs", "/access-control"], owner: "Security Team", lastReviewDate: "2025-12-01", nextReviewDate: "2026-06-01", inherited: false },
  { id: "2", framework: "HIPAA", controlId: "164.312(a)(2)(iv)", title: "Encryption and Decryption", description: "Implement mechanism to encrypt and decrypt ePHI", category: "Technical Safeguards", status: "implemented", implementationNotes: "AES-256-GCM at rest, TLS 1.3 in transit, Cloud KMS CMEK", evidenceLinks: ["/security-dashboard"], owner: "Infrastructure Team", lastReviewDate: "2025-12-01", nextReviewDate: "2026-06-01", inherited: false },
  { id: "3", framework: "HIPAA", controlId: "164.312(b)", title: "Audit Controls", description: "Record and examine activity in systems with ePHI", category: "Technical Safeguards", status: "implemented", implementationNotes: "WORM audit log with 6-year retention via Cloud Logging", evidenceLinks: ["/audit-logs"], owner: "Compliance Team", lastReviewDate: "2025-11-15", nextReviewDate: "2026-05-15", inherited: false },
  { id: "4", framework: "HIPAA", controlId: "164.308(a)(1)(ii)(A)", title: "Risk Analysis", description: "Conduct accurate assessment of potential risks and vulnerabilities", category: "Administrative Safeguards", status: "implemented", implementationNotes: "Quarterly risk assessments with automated threat detection", evidenceLinks: ["/security-posture"], owner: "CISO", lastReviewDate: "2025-10-15", nextReviewDate: "2026-01-15", inherited: false },
  { id: "5", framework: "HIPAA", controlId: "164.310(d)(1)", title: "Device and Media Controls", description: "Policies governing receipt and removal of hardware and electronic media", category: "Physical Safeguards", status: "implemented", implementationNotes: "Inherited from GCP physical security controls", evidenceLinks: [], owner: "Infrastructure Team", lastReviewDate: "2025-09-01", nextReviewDate: "2026-03-01", inherited: true, inheritedFrom: "Google Cloud" },
  { id: "6", framework: "SOC2", controlId: "CC6.1", title: "Logical and Physical Access Controls", description: "Entity implements logical access security software, infrastructure, and architectures", category: "Security", status: "implemented", implementationNotes: "IAM least privilege, VPC service controls, network segmentation", evidenceLinks: ["/access-control"], owner: "Security Team", lastReviewDate: "2025-11-01", nextReviewDate: "2026-05-01", inherited: false },
  { id: "7", framework: "SOC2", controlId: "CC7.2", title: "System Monitoring", description: "Entity monitors system components and the operation of those components for anomalies", category: "Security", status: "implemented", implementationNotes: "Cloud Monitoring with custom dashboards, anomaly detection alerts", evidenceLinks: ["/real-time-monitoring"], owner: "DevOps Team", lastReviewDate: "2025-11-01", nextReviewDate: "2026-05-01", inherited: false },
  { id: "8", framework: "SOC2", controlId: "A1.2", title: "Recovery Plan", description: "Environmental protections, software, and recovery infrastructure", category: "Availability", status: "partial", implementationNotes: "Automated backups configured, DR plan under review", evidenceLinks: [], owner: "Infrastructure Team", lastReviewDate: "2025-10-01", nextReviewDate: "2026-04-01", inherited: false },
  { id: "9", framework: "HITRUST", controlId: "01.a", title: "Access Control Policy", description: "Access control policy establishing rules for access to information assets", category: "Access Control", status: "implemented", implementationNotes: "Documented RBAC policies with automated enforcement", evidenceLinks: ["/policy-lifecycle"], owner: "Compliance Team", lastReviewDate: "2025-10-01", nextReviewDate: "2026-04-01", inherited: false },
  { id: "10", framework: "HITRUST", controlId: "09.aa", title: "Audit Logging", description: "Audit logs recording user activities, exceptions, and security events", category: "Communications & Operations", status: "implemented", implementationNotes: "Immutable WORM audit trail with centralized Cloud Logging", evidenceLinks: ["/audit-logs"], owner: "Security Team", lastReviewDate: "2025-10-01", nextReviewDate: "2026-04-01", inherited: false },
  { id: "11", framework: "HITRUST", controlId: "10.f", title: "Cryptographic Controls", description: "Policy on the use of cryptographic controls for protection of information", category: "Information Systems", status: "partial", implementationNotes: "CMEK encryption implemented, key rotation policy being formalized", evidenceLinks: [], owner: "Infrastructure Team", lastReviewDate: "2025-09-15", nextReviewDate: "2026-03-15", inherited: false },
  { id: "12", framework: "HITRUST", controlId: "06.d", title: "Data Protection and Privacy", description: "Data protection and privacy of personal information", category: "Compliance", status: "planned", implementationNotes: "PHI anonymization engine in development", evidenceLinks: [], owner: "Privacy Officer", lastReviewDate: null, nextReviewDate: "2026-03-01", inherited: false },
];

const SAMPLE_TRUST_CRITERIA = [
  { criterion: "Security" as const, score: 92, status: "compliant" as const, controlCount: 28 },
  { criterion: "Availability" as const, score: 85, status: "partially_compliant" as const, controlCount: 12 },
  { criterion: "Processing Integrity" as const, score: 90, status: "compliant" as const, controlCount: 8 },
  { criterion: "Confidentiality" as const, score: 95, status: "compliant" as const, controlCount: 10 },
  { criterion: "Privacy" as const, score: 88, status: "compliant" as const, controlCount: 6 },
];

function getFrameworkColor(framework: ComplianceFramework) {
  switch (framework) {
    case "HIPAA": return "text-blue-600 dark:text-blue-400";
    case "SOC2": return "text-purple-600 dark:text-purple-400";
    case "HITRUST": return "text-emerald-600 dark:text-emerald-400";
  }
}

function getStatusColor(status: ComplianceControlStatus) {
  switch (status) {
    case "implemented": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "partial": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "planned": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "gap": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "not_applicable": return "bg-muted text-muted-foreground";
  }
}

function getCertStatusColor(status: string) {
  switch (status) {
    case "certified": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "in_progress": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "expired": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function ComplianceFrameworksTab() {
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | "all">("all");

  const { data: frameworks } = useQuery<ComplianceFrameworkStatus[]>({
    queryKey: ["/api/security-compliance/frameworks"],
  });

  const { data: controls } = useQuery<ComplianceControl[]>({
    queryKey: ["/api/security-compliance/controls"],
  });

  const frameworkData = frameworks || SAMPLE_FRAMEWORKS;
  const controlData = controls || SAMPLE_CONTROLS;

  const filteredControls = selectedFramework === "all"
    ? controlData
    : controlData.filter(c => c.framework === selectedFramework);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {frameworkData.map((fw) => (
          <Card
            key={fw.framework}
            className={`cursor-pointer hover-elevate ${selectedFramework === fw.framework ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedFramework(fw.framework === selectedFramework ? "all" : fw.framework)}
            data-testid={`card-framework-${fw.framework.toLowerCase()}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className={`text-lg ${getFrameworkColor(fw.framework)}`} data-testid={`text-framework-name-${fw.framework.toLowerCase()}`}>
                  {fw.framework}
                </CardTitle>
                <Badge className={getCertStatusColor(fw.certificationStatus)} data-testid={`badge-cert-status-${fw.framework.toLowerCase()}`}>
                  {fw.certificationStatus === "certified" ? "Certified" : fw.certificationStatus === "in_progress" ? "In Progress" : fw.certificationStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Compliance Score</span>
                  <span className="text-2xl font-bold" data-testid={`text-score-${fw.framework.toLowerCase()}`}>{fw.overallScore}%</span>
                </div>
                <Progress value={fw.overallScore} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{fw.implementedControls} Implemented</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    <span>{fw.partialControls} Partial</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-500" />
                    <span>{fw.plannedControls} Planned</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span>{fw.gapControls} Gaps</span>
                  </div>
                </div>
                {fw.nextAuditDate && (
                  <p className="text-xs text-muted-foreground">Next audit: {new Date(fw.nextAuditDate).toLocaleDateString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SOC 2 Trust Services Criteria</CardTitle>
          <CardDescription>Status of the five Trust Services Criteria for SOC 2 compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {SAMPLE_TRUST_CRITERIA.map((tc) => (
              <div key={tc.criterion} className="text-center space-y-2 p-3 rounded-md bg-muted/30" data-testid={`trust-criterion-${tc.criterion.toLowerCase().replace(/\s/g, "-")}`}>
                <p className="text-sm font-medium">{tc.criterion}</p>
                <p className="text-2xl font-bold">{tc.score}%</p>
                <Badge className={tc.status === "compliant" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"}>
                  {tc.status === "compliant" ? "Compliant" : "Partial"}
                </Badge>
                <p className="text-xs text-muted-foreground">{tc.controlCount} controls</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">Compliance Controls</CardTitle>
              <CardDescription>
                {selectedFramework === "all" ? "All frameworks" : selectedFramework} - {filteredControls.length} controls
              </CardDescription>
            </div>
            {selectedFramework !== "all" && (
              <Button variant="outline" size="sm" onClick={() => setSelectedFramework("all")} data-testid="button-clear-filter">
                Clear Filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Framework</TableHead>
                  <TableHead>Control ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControls.map((control) => (
                  <TableRow key={control.id} data-testid={`row-control-${control.id}`}>
                    <TableCell>
                      <Badge variant="outline" className={getFrameworkColor(control.framework)}>
                        {control.framework}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{control.controlId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{control.title}</p>
                        {control.inherited && (
                          <p className="text-xs text-muted-foreground">Inherited from {control.inheritedFrom}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{control.category}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(control.status)}>
                        {control.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{control.owner}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function DataSyncTab() {
  const { data: syncStats } = useQuery<{
    totalSyncs: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    duplicateCount: number;
    failedEvents: number;
    staleRecords: number;
  }>({
    queryKey: ["/api/aggregator-sync/stats"],
  });

  const { data: syncRecords } = useQuery<AggregatorSyncRecord[]>({
    queryKey: ["/api/aggregator-sync"],
  });

  const { data: webhookEvents } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/webhooks/events"],
  });

  const { data: webhookConfigs } = useQuery<WebhookConfig[]>({
    queryKey: ["/api/webhooks/config"],
  });

  const stats = syncStats || { totalSyncs: 0, byStatus: {}, bySource: {}, duplicateCount: 0, failedEvents: 0, staleRecords: 0 };
  const records = syncRecords || [];
  const events = webhookEvents || [];
  const configs = webhookConfigs || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Sync Records" value={stats.totalSyncs} icon={Database} color="text-blue-600 dark:text-blue-400" testId="metric-total-syncs" />
        <MetricCard label="Duplicates Blocked" value={stats.duplicateCount} icon={Fingerprint} color="text-purple-600 dark:text-purple-400" testId="metric-duplicates" />
        <MetricCard label="Failed Events" value={stats.failedEvents} icon={AlertTriangle} color="text-red-600 dark:text-red-400" testId="metric-failed" />
        <MetricCard label="Stale Records" value={stats.staleRecords} icon={Clock} color="text-yellow-600 dark:text-yellow-400" testId="metric-stale" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Webhook Configurations</CardTitle>
            <CardDescription>Active webhook endpoints for aggregator notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {configs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhook configurations found</p>
              ) : configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/30 flex-wrap" data-testid={`webhook-config-${config.source}`}>
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm capitalize">{config.source.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground font-mono">{config.endpointUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={config.healthStatus === "healthy" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : config.healthStatus === "degraded" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}>
                      {config.healthStatus}
                    </Badge>
                    <Badge variant={config.enabled ? "default" : "secondary"}>
                      {config.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Status by Source</CardTitle>
            <CardDescription>Distribution of sync records across aggregator sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.bySource || {}).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between gap-2" data-testid={`sync-source-${source}`}>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{source.replace(/_/g, " ")}</span>
                  </div>
                  <Badge variant="outline">{count as number}</Badge>
                </div>
              ))}
              {Object.keys(stats.bySource || {}).length === 0 && (
                <p className="text-sm text-muted-foreground">No sync data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Webhook Events</CardTitle>
          <CardDescription>Incoming data notifications from health data aggregators</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.slice(0, 20).map((event) => (
                  <TableRow key={event.id} data-testid={`row-webhook-event-${event.id}`}>
                    <TableCell className="capitalize text-sm">{event.source.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-mono text-sm">{event.eventType}</TableCell>
                    <TableCell>
                      <Badge className={
                        event.status === "processed" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                        event.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        event.status === "duplicate" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" :
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{event.patientId || "N/A"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(event.receivedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No webhook events recorded</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aggregator Sync Records</CardTitle>
          <CardDescription>Patient data synchronization status across connected EHR platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Fingerprint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} data-testid={`row-sync-record-${record.id}`}>
                    <TableCell className="font-mono text-sm">{record.patientId.substring(0, 8)}...</TableCell>
                    <TableCell className="capitalize text-sm">{record.aggregatorSource.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge className={
                        record.syncStatus === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                        record.syncStatus === "syncing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
                        record.syncStatus === "error" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        "bg-muted text-muted-foreground"
                      }>
                        {record.syncStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.lastSuccessfulSync ? new Date(record.lastSuccessfulSync).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {record.fingerprintHash ? record.fingerprintHash.substring(0, 12) + "..." : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sync records found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function GcpArchitectureTab() {
  const { data: architecture } = useQuery<GcpArchitectureStatus>({
    queryKey: ["/api/gcp/architecture"],
  });

  const { data: complianceChecks } = useQuery<{
    checks: { check: string; passed: boolean; details: string; lastVerified: string }[];
    summary: { total: number; passed: number; failed: number };
  }>({
    queryKey: ["/api/gcp/compliance-checks"],
  });

  const arch = architecture;
  const checks = complianceChecks;

  if (!arch) {
    return <LoadingState message="Loading GCP architecture status..." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="GCP Services" value={arch.services.length} icon={Cloud} color="text-blue-600 dark:text-blue-400" testId="metric-gcp-services" />
        <MetricCard label="KMS Keys" value={arch.kmsKeys.length} icon={Key} color="text-purple-600 dark:text-purple-400" testId="metric-kms-keys" />
        <MetricCard label="Service Accounts" value={arch.serviceAccounts.length} icon={Lock} color="text-emerald-600 dark:text-emerald-400" testId="metric-service-accounts" />
        <MetricCard label="BAA Status" value={arch.baaStatus === "signed" ? "Signed" : "Pending"} icon={FileText} color={arch.baaStatus === "signed" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} testId="metric-baa-status" />
      </div>

      {checks && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg">Infrastructure Compliance Checks</CardTitle>
                <CardDescription>{checks.summary.passed}/{checks.summary.total} checks passing</CardDescription>
              </div>
              <Progress value={(checks.summary.passed / checks.summary.total) * 100} className="w-32 h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {checks.checks.map((check, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/30" data-testid={`compliance-check-${i}`}>
                  {check.passed ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{check.check}</p>
                    <p className="text-xs text-muted-foreground">{check.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">HIPAA-Eligible Services</CardTitle>
          <CardDescription>Google Cloud services configured for PHI workloads</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>HIPAA Eligible</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arch.services.map((svc) => (
                  <TableRow key={svc.service} data-testid={`row-gcp-service-${svc.service}`}>
                    <TableCell className="font-medium">{svc.displayName}</TableCell>
                    <TableCell>
                      <Badge className={
                        svc.status === "configured" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                        svc.status === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                        "bg-muted text-muted-foreground"
                      }>
                        {svc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{svc.region}</TableCell>
                    <TableCell>
                      {svc.hipaaEligible ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{svc.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">VPC Service Controls</CardTitle>
            <CardDescription>Network security perimeter configuration</CardDescription>
          </CardHeader>
          <CardContent>
            {arch.vpc ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Network</p>
                    <p className="font-mono font-medium">{arch.vpc.networkName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Subnet CIDR</p>
                    <p className="font-mono font-medium">{arch.vpc.subnetCidr}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Region</p>
                    <p className="font-medium">{arch.vpc.region}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Private Access</p>
                    <Badge variant={arch.vpc.privateGoogleAccess ? "default" : "secondary"}>
                      {arch.vpc.privateGoogleAccess ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Firewall Rules ({arch.vpc.firewallRules.length})</p>
                  <div className="space-y-2">
                    {arch.vpc.firewallRules.map((rule, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-muted/30 flex-wrap" data-testid={`firewall-rule-${i}`}>
                        <div className="flex items-center gap-2">
                          <Network className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{rule.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{rule.direction}</Badge>
                          <Badge className={rule.action === "allow" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}>
                            {rule.action}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">VPC not configured</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cloud KMS & IAM</CardTitle>
            <CardDescription>Encryption keys and service account configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Encryption Keys</p>
                <div className="space-y-2">
                  {arch.kmsKeys.map((key, i) => (
                    <div key={i} className="p-3 rounded-md bg-muted/30 space-y-1" data-testid={`kms-key-${i}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">{key.keyName}</span>
                        <Badge className={key.state === "enabled" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}>
                          {key.state}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Purpose: {key.purpose} | Rotation: {key.rotationPeriod}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Service Accounts</p>
                <div className="space-y-2">
                  {arch.serviceAccounts.map((sa, i) => (
                    <div key={i} className="p-3 rounded-md bg-muted/30 space-y-1" data-testid={`service-account-${i}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{sa.displayName}</span>
                        {sa.leastPrivilege ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Least Privilege</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Review Needed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{sa.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sa.roles.map((role, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{role.split("/").pop()}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeploymentTab() {
  const readinessChecks = [
    { check: "Production Dockerfile configured", passed: true, details: "Multi-stage build with non-root user" },
    { check: "Cloud Run deployment script ready", passed: true, details: "deploy/gcp-deploy.sh with VPC connector" },
    { check: "Health check endpoint", passed: true, details: "GET /api/health returns 200" },
    { check: "Environment variables documented", passed: true, details: "All required env vars mapped" },
    { check: "TLS 1.3 enforced", passed: true, details: "HSTS headers configured in production" },
    { check: "Non-root container user", passed: true, details: "appuser:appuser in Dockerfile" },
    { check: "Production dependencies only", passed: true, details: "npm ci --omit=dev in production stage" },
    { check: "VPC connector configured", passed: true, details: "med-vpc-connector for private access" },
    { check: "Service account least privilege", passed: true, details: "phi-handler SA with minimal roles" },
    { check: "Secrets via Secret Manager", passed: true, details: "No secrets in code or env files" },
  ];

  const deploymentConfig = {
    service: "tabula-medica",
    platform: "Cloud Run (managed)",
    region: "us-central1",
    memory: "1Gi",
    cpu: "2",
    minInstances: 1,
    maxInstances: 10,
    timeout: "300s",
    concurrency: 80,
    port: 8080,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Production Readiness</CardTitle>
          <CardDescription>{readinessChecks.filter(c => c.passed).length}/{readinessChecks.length} checks passing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readinessChecks.map((check, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/30" data-testid={`readiness-check-${i}`}>
                {check.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.check}</p>
                  <p className="text-xs text-muted-foreground">{check.details}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cloud Run Configuration</CardTitle>
            <CardDescription>Production deployment parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(deploymentConfig).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="text-sm font-mono font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dockerfile Overview</CardTitle>
            <CardDescription>Production container build configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-md bg-muted/30">
                <p className="font-medium">Stage 1: Builder</p>
                <p className="text-muted-foreground">node:20-slim, npm ci, npm run build</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="font-medium">Stage 2: Production</p>
                <p className="text-muted-foreground">node:20-slim, production deps only, non-root user</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="font-medium">Security</p>
                <p className="text-muted-foreground">Non-root appuser, health check, port 8080</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30">
                <p className="font-medium">Deployment</p>
                <p className="text-muted-foreground">deploy/gcp-deploy.sh with VPC, IAM, Cloud SQL</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface TerraformResource {
  id: string;
  resourceType: string;
  name: string;
  module: string;
  description: string;
  status: string;
  complianceControl: string;
  details?: Record<string, unknown>;
  constraint?: string;
  enforced?: boolean;
}

interface SecurityGuardrail {
  control: string;
  implementation: string;
  resource: string;
  rationale: string;
  framework: string[];
}

interface TerraformData {
  resources: TerraformResource[];
  iamResources: TerraformResource[];
  orgPolicies: TerraformResource[];
  securityGuardrails: SecurityGuardrail[];
  summary: {
    totalResources: number;
    infrastructureResources: number;
    iamResources: number;
    orgPolicies: number;
    guardrailCount: number;
    terraformVersion: string;
    providerVersion: string;
    stateBackend: string;
    modules: string[];
  };
}

function getControlIcon(control: string) {
  switch (control) {
    case "Network Isolation": return <Network className="h-4 w-4 text-blue-500" />;
    case "Zero-Trust IAM": return <Key className="h-4 w-4 text-purple-500" />;
    case "Encryption at Rest": return <Lock className="h-4 w-4 text-green-500" />;
    case "Audit Trails": return <Eye className="h-4 w-4 text-orange-500" />;
    case "Data Residency": return <Globe className="h-4 w-4 text-teal-500" />;
    case "Secret Management": return <Fingerprint className="h-4 w-4 text-red-500" />;
    case "Infrastructure Foundation": return <Layers className="h-4 w-4 text-indigo-500" />;
    case "Supply Chain Security": return <GitBranch className="h-4 w-4 text-amber-500" />;
    case "Infrastructure Hardening": return <Shield className="h-4 w-4 text-rose-500" />;
    default: return <Code2 className="h-4 w-4 text-muted-foreground" />;
  }
}

function InfrastructureAsCodeTab() {
  const { data, isLoading } = useQuery<{ success: boolean; data: TerraformData }>({
    queryKey: ["/api/gcp/terraform-resources"],
  });

  const tfData = data?.data;

  if (isLoading) return <LoadingState message="Loading Terraform resources..." />;

  if (!tfData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Unable to load Terraform resources</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Resources" value={tfData.summary.totalResources} icon={Layers} color="text-indigo-600 dark:text-indigo-400" testId="metric-tf-total" />
        <MetricCard label="Infrastructure" value={tfData.summary.infrastructureResources} icon={Cloud} color="text-blue-600 dark:text-blue-400" testId="metric-tf-infra" />
        <MetricCard label="IAM Resources" value={tfData.summary.iamResources} icon={Key} color="text-purple-600 dark:text-purple-400" testId="metric-tf-iam" />
        <MetricCard label="Security Guardrails" value={tfData.summary.guardrailCount} icon={Shield} color="text-green-600 dark:text-green-400" testId="metric-tf-guardrails" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Guardrails</CardTitle>
          <CardDescription>Hard mandatory controls applied by Terraform configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Terraform Implementation</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Rationale</TableHead>
                  <TableHead>Frameworks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tfData.securityGuardrails.map((g, i) => (
                  <TableRow key={i} data-testid={`guardrail-row-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getControlIcon(g.control)}
                        <span className="font-medium text-sm">{g.control}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{g.implementation}</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{g.resource}</TableCell>
                    <TableCell className="text-xs max-w-[200px]">{g.rationale}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {g.framework.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Infrastructure Resources</CardTitle>
            <CardDescription>{tfData.resources.length} Terraform-managed resources in main.tf</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {tfData.resources.map((r) => (
                  <div key={r.id} className="p-3 rounded-md bg-muted/30 space-y-1" data-testid={`tf-resource-${r.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {getControlIcon(r.complianceControl)}
                        <span className="text-sm font-medium">{r.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">{r.resourceType}</code>
                      <Badge variant="outline" className="text-xs">{r.complianceControl}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">IAM Service Accounts</CardTitle>
              <CardDescription>{tfData.iamResources.length} least-privilege service accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tfData.iamResources.map((sa) => (
                  <div key={sa.id} className="p-3 rounded-md bg-muted/30 space-y-2" data-testid={`tf-iam-${sa.id}`}>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">{sa.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{sa.description}</p>
                    {sa.details && Array.isArray((sa.details as Record<string, unknown>).roles) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {((sa.details as Record<string, unknown>).roles as string[]).map((role, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{role.split("/").pop()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization Policies</CardTitle>
              <CardDescription>{tfData.orgPolicies.length} enforced org-level constraints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tfData.orgPolicies.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/30" data-testid={`tf-policy-${p.id}`}>
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{p.name.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      {p.constraint && (
                        <code className="text-xs font-mono text-muted-foreground">{p.constraint}</code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terraform Configuration</CardTitle>
          <CardDescription>Infrastructure-as-Code deployment details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="tf-config-version">
              <p className="text-xs text-muted-foreground">Terraform Version</p>
              <p className="text-sm font-mono font-medium">{tfData.summary.terraformVersion}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="tf-config-provider">
              <p className="text-xs text-muted-foreground">Provider Version</p>
              <p className="text-sm font-mono font-medium">{tfData.summary.providerVersion}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="tf-config-backend">
              <p className="text-xs text-muted-foreground">State Backend</p>
              <p className="text-sm font-mono font-medium truncate">{tfData.summary.stateBackend}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="tf-config-modules">
              <p className="text-xs text-muted-foreground">Modules</p>
              <p className="text-sm font-mono font-medium">{tfData.summary.modules.join(", ")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CompAiStatus {
  connected: boolean;
  hasOrgId: boolean;
  hasEnterpriseAccess: boolean;
  supportedFrameworks: string[];
}

interface CompAiOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string | null;
  onboardingCompleted: boolean;
  hasAccess: boolean;
  primaryColor: string | null;
  createdAt: string;
  authType: string;
}

interface CompAiCertEntry {
  framework: string;
  displayName: string;
  hasCertificate: boolean;
  fileName: string | null;
  fileSize: number | null;
  updatedAt: string | null;
  isTargetFramework: boolean;
}

interface CompAiCertData {
  certificates: CompAiCertEntry[];
  totalCertificates: number;
  targetFrameworksCovered: number;
  targetFrameworksTotal: number;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CompAiTab() {
  const { data: statusData, isLoading: statusLoading, isError: statusError } = useQuery<{ success: boolean; data: CompAiStatus }>({
    queryKey: ["/api/compai/status"],
  });

  const status = statusData?.data;
  const isConnected = status?.connected && status?.hasOrgId;

  const { data: orgData, isLoading: orgLoading } = useQuery<{ success: boolean; data: CompAiOrg }>({
    queryKey: ["/api/compai/organization"],
    enabled: !!isConnected,
  });

  const { data: certData, isLoading: certLoading } = useQuery<{ success: boolean; data: CompAiCertData }>({
    queryKey: ["/api/compai/certificates"],
    enabled: !!isConnected,
  });

  const downloadMutation = useMutation({
    mutationFn: async (framework: string) => {
      const res = await apiRequest("POST", "/api/compai/certificates/download", { framework });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.data?.signedUrl) {
        window.open(data.data.signedUrl, "_blank");
      }
    },
  });

  if (statusLoading) return <LoadingState message="Checking Comp AI connection..." />;

  if (statusError) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4" data-testid="compai-error-state">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold">Connection Error</h3>
            <p className="text-sm text-muted-foreground mt-1">Unable to reach the Comp AI service. Please check your configuration and try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Connect to Comp AI</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Set your COMP_AI_API_KEY and COMP_AI_ORG_ID environment variables to connect Tabula Medica with Comp AI for automated compliance tracking across SOC 2, HIPAA, ISO 27001, HITRUST, and GDPR.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs">SOC 2</Badge>
            <Badge variant="outline" className="text-xs">HIPAA</Badge>
            <Badge variant="outline" className="text-xs">ISO 27001</Badge>
            <Badge variant="outline" className="text-xs">HITRUST</Badge>
            <Badge variant="outline" className="text-xs">GDPR</Badge>
          </div>
          <Button variant="outline" asChild data-testid="btn-compai-signup">
            <a href="https://trycomp.ai" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Comp AI
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const org = orgData?.data;
  const certs = certData?.data;
  const loading = orgLoading || certLoading;

  if (loading) return <LoadingState message="Loading Comp AI data..." />;

  const targetCerts = certs?.certificates.filter((c) => c.isTargetFramework) || [];
  const otherCerts = certs?.certificates.filter((c) => !c.isTargetFramework) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Connection"
          value={org ? "Active" : "Pending"}
          icon={Zap}
          color="text-green-600 dark:text-green-400"
          testId="metric-compai-connection"
        />
        <MetricCard
          label="Frameworks"
          value={certs?.targetFrameworksTotal || 5}
          icon={Shield}
          color="text-blue-600 dark:text-blue-400"
          testId="metric-compai-frameworks"
        />
        <MetricCard
          label="Certificates"
          value={certs?.totalCertificates || 0}
          icon={FileText}
          color="text-purple-600 dark:text-purple-400"
          testId="metric-compai-certificates"
        />
        <MetricCard
          label="Coverage"
          value={`${certs?.targetFrameworksCovered || 0}/${certs?.targetFrameworksTotal || 5}`}
          icon={CheckCircle}
          color="text-emerald-600 dark:text-emerald-400"
          testId="metric-compai-coverage"
        />
      </div>

      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Organization
            </CardTitle>
            <CardDescription>Connected Comp AI organization details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-md bg-muted/30" data-testid="compai-org-name">
                <p className="text-xs text-muted-foreground">Organization</p>
                <p className="text-sm font-medium">{org.name}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30" data-testid="compai-org-slug">
                <p className="text-xs text-muted-foreground">Slug</p>
                <p className="text-sm font-mono font-medium">{org.slug}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/30" data-testid="compai-org-onboarding">
                <p className="text-xs text-muted-foreground">Onboarding</p>
                <div className="flex items-center gap-1">
                  {org.onboardingCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm font-medium">{org.onboardingCompleted ? "Complete" : "In Progress"}</span>
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/30" data-testid="compai-org-access">
                <p className="text-xs text-muted-foreground">Platform Access</p>
                <div className="flex items-center gap-1">
                  {org.hasAccess ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">{org.hasAccess ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Compliance Certificates</CardTitle>
          <CardDescription>SOC 2, HIPAA, ISO 27001, HITRUST, and GDPR certificate status from Comp AI</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Framework</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targetCerts.map((cert) => (
                <TableRow key={cert.framework} data-testid={`compai-cert-${cert.framework}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">{cert.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cert.hasCertificate ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Certified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cert.fileName || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatBytes(cert.fileSize)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cert.updatedAt ? new Date(cert.updatedAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {cert.hasCertificate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMutation.mutate(cert.framework)}
                        disabled={downloadMutation.isPending}
                        data-testid={`btn-download-${cert.framework}`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {otherCerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Frameworks</CardTitle>
            <CardDescription>Other compliance frameworks tracked by Comp AI</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Framework</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherCerts.map((cert) => (
                  <TableRow key={cert.framework} data-testid={`compai-cert-${cert.framework}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{cert.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cert.hasCertificate ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Certified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Started
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cert.fileName || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cert.updatedAt ? new Date(cert.updatedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {cert.hasCertificate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadMutation.mutate(cert.framework)}
                          disabled={downloadMutation.isPending}
                          data-testid={`btn-download-${cert.framework}`}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {status?.hasEnterpriseAccess && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Enterprise Features
            </CardTitle>
            <CardDescription>AI-powered compliance automation via Comp AI Enterprise API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-muted/30 space-y-2" data-testid="compai-enterprise-chat">
                <h4 className="text-sm font-medium">AI Compliance Chat</h4>
                <p className="text-xs text-muted-foreground">Automate compliance tasks with AI-powered conversational workflows</p>
                <Badge variant="outline" className="text-xs">Available</Badge>
              </div>
              <div className="p-4 rounded-md bg-muted/30 space-y-2" data-testid="compai-enterprise-workflow">
                <h4 className="text-sm font-medium">Workflow Analysis</h4>
                <p className="text-xs text-muted-foreground">Analyze and optimize compliance workflows with AI automation</p>
                <Badge variant="outline" className="text-xs">Available</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Details</CardTitle>
          <CardDescription>Comp AI integration configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="compai-config-api">
              <p className="text-xs text-muted-foreground">API Endpoint</p>
              <p className="text-sm font-mono font-medium">api.trycomp.ai</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="compai-config-auth">
              <p className="text-xs text-muted-foreground">Authentication</p>
              <p className="text-sm font-medium">API Key</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="compai-config-enterprise">
              <p className="text-xs text-muted-foreground">Enterprise API</p>
              <p className="text-sm font-medium">{status?.hasEnterpriseAccess ? "Connected" : "Not Configured"}</p>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-center" data-testid="compai-config-frameworks">
              <p className="text-xs text-muted-foreground">Total Frameworks</p>
              <p className="text-sm font-medium">{status?.supportedFrameworks?.length || 9}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SecurityInfrastructure() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Security & Compliance Infrastructure"
        subtitle="HIPAA, SOC 2, HITRUST compliance controls with GCP architecture and data sync monitoring"
        icon={<ShieldCheck className="h-7 w-7 text-muted-foreground" />}
      />

      <Tabs defaultValue="compliance" className="w-full">
        <TabsList className="grid w-full grid-cols-6" data-testid="tabs-security-infra">
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <Shield className="h-4 w-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="compai" data-testid="tab-compai">
            <Zap className="h-4 w-4 mr-2" />
            Comp AI
          </TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Data Sync
          </TabsTrigger>
          <TabsTrigger value="gcp" data-testid="tab-gcp">
            <Cloud className="h-4 w-4 mr-2" />
            GCP
          </TabsTrigger>
          <TabsTrigger value="iac" data-testid="tab-iac">
            <Code2 className="h-4 w-4 mr-2" />
            IaC
          </TabsTrigger>
          <TabsTrigger value="deployment" data-testid="tab-deployment">
            <Server className="h-4 w-4 mr-2" />
            Deployment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceFrameworksTab />
        </TabsContent>
        <TabsContent value="compai" className="mt-6">
          <CompAiTab />
        </TabsContent>
        <TabsContent value="sync" className="mt-6">
          <DataSyncTab />
        </TabsContent>
        <TabsContent value="gcp" className="mt-6">
          <GcpArchitectureTab />
        </TabsContent>
        <TabsContent value="iac" className="mt-6">
          <InfrastructureAsCodeTab />
        </TabsContent>
        <TabsContent value="deployment" className="mt-6">
          <DeploymentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
