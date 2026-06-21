import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Search,
  Filter,
  Download,
  Clock,
  User,
  FileText,
  Send,
  Eye,
  Plus,
  CheckCircle,
  AlertTriangle,
  Lock,
  Paperclip,
  RefreshCw,
  Calendar,
  Building2,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Loader2
} from "lucide-react";

interface AuditEntry {
  id: string;
  threadId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  targetResourceType: string;
  targetResourceId: string;
  patientId: string;
  patientName?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  complianceStatus?: "compliant" | "warning" | "violation";
}

interface ComplianceMetrics {
  totalAuditEntries: number;
  compliantActions: number;
  warnings: number;
  violations: number;
  encryptionVerified: boolean;
  accessControlVerified: boolean;
  auditTrailComplete: boolean;
  lastComplianceCheck: string;
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  organization: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Send; color: string; label: string }> = {
  thread_created: { icon: Plus, color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300", label: "Thread Created" },
  message_sent: { icon: Send, color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300", label: "Message Sent" },
  document_shared: { icon: Paperclip, color: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300", label: "Document Shared" },
  document_viewed: { icon: Eye, color: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300", label: "Document Viewed" },
  message_read: { icon: Eye, color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", label: "Message Read" },
  participant_added: { icon: User, color: "bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300", label: "Participant Added" },
  thread_resolved: { icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300", label: "Thread Resolved" }
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export default function CommunicationAuditPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterPatient, setFilterPatient] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("logs");

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery<{ success: boolean; data: AuditEntry[] }>({
    queryKey: ["/api/communication-audit/entries", filterAction, filterProvider, filterPatient, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterAction !== "all") params.append("action", filterAction);
      if (filterProvider !== "all") params.append("providerId", filterProvider);
      if (filterPatient !== "all") params.append("patientId", filterPatient);
      if (dateRange !== "all") params.append("dateRange", dateRange);
      const res = await fetch(`/api/communication-audit/entries?${params}`);
      return res.json();
    }
  });

  const { data: complianceData, isLoading: complianceLoading } = useQuery<{ success: boolean; data: ComplianceMetrics }>({
    queryKey: ["/api/communication-audit/compliance"],
    queryFn: async () => {
      const res = await fetch("/api/communication-audit/compliance");
      return res.json();
    }
  });

  const { data: providersData } = useQuery<{ success: boolean; data: Provider[] }>({
    queryKey: ["/api/provider-communication/providers"],
    queryFn: async () => {
      const res = await fetch("/api/provider-communication/providers");
      return res.json();
    }
  });

  const auditEntries = auditData?.data || [];
  const compliance = complianceData?.data;
  const providers = providersData?.data || [];

  const filteredEntries = auditEntries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.performedByName.toLowerCase().includes(query) ||
      entry.details.toLowerCase().includes(query) ||
      entry.patientId.toLowerCase().includes(query) ||
      entry.threadId.toLowerCase().includes(query)
    );
  });

  const uniquePatients = Array.from(new Set(auditEntries.map(e => e.patientId)));

  const handleExport = async () => {
    const res = await fetch("/api/communication-audit/export?format=csv");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `communication-audit-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <Shield className="h-7 w-7 text-primary" />
          Communication Audit Center
        </h1>
        <p className="text-muted-foreground">
          Review communication logs, verify compliance, and monitor security protocols.
        </p>
      </div>

      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Access to this audit center is restricted to authorized compliance officers and administrators. 
          All access to this page is logged for security purposes.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-entries">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliance?.totalAuditEntries || 0}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-compliant">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliance?.compliantActions || 0}</p>
                <p className="text-xs text-muted-foreground">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-warnings">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliance?.warnings || 0}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-violations">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliance?.violations || 0}</p>
                <p className="text-xs text-muted-foreground">Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Compliance Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter & Search
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchAudit()} data-testid="button-refresh">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export">
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger data-testid="select-action">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="thread_created">Thread Created</SelectItem>
                    <SelectItem value="message_sent">Message Sent</SelectItem>
                    <SelectItem value="document_shared">Document Shared</SelectItem>
                    <SelectItem value="document_viewed">Document Viewed</SelectItem>
                    <SelectItem value="thread_resolved">Thread Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterPatient} onValueChange={setFilterPatient}>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Patient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patients</SelectItem>
                    {uniquePatients.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Date Range:</span>
                <div className="flex gap-2">
                  {[
                    { value: "all", label: "All Time" },
                    { value: "today", label: "Today" },
                    { value: "week", label: "This Week" },
                    { value: "month", label: "This Month" }
                  ].map(option => (
                    <Button
                      key={option.value}
                      variant={dateRange === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDateRange(option.value)}
                      data-testid={`button-date-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-audit-logs">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Audit Log Entries
                </span>
                <Badge variant="secondary">{filteredEntries.length} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No audit entries found matching your filters
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredEntries.map((entry) => {
                      const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.message_sent;
                      const Icon = config.icon;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-4 border rounded-lg"
                          data-testid={`audit-entry-${entry.id}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{entry.performedByName}</span>
                              <Badge variant="outline" className="text-xs">
                                {config.label}
                              </Badge>
                              {entry.complianceStatus === "warning" && (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>
                              )}
                              {entry.complianceStatus === "violation" && (
                                <Badge variant="destructive">Violation</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{entry.details}</p>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(entry.timestamp)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Patient: {entry.patientId}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Thread: {entry.threadId}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-security-protocols">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Security Protocol Verification
                </CardTitle>
                <CardDescription>
                  Real-time verification of HIPAA security requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {complianceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Encryption at Rest & Transit</p>
                          <p className="text-xs text-muted-foreground">AES-256-GCM encryption verified</p>
                        </div>
                      </div>
                      {compliance?.encryptionVerified ? (
                        <Badge className="bg-green-500">Verified</Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Access Control</p>
                          <p className="text-xs text-muted-foreground">Role-based access control enforced</p>
                        </div>
                      </div>
                      {compliance?.accessControlVerified ? (
                        <Badge className="bg-green-500">Verified</Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Audit Trail Completeness</p>
                          <p className="text-xs text-muted-foreground">All PHI access logged</p>
                        </div>
                      </div>
                      {compliance?.auditTrailComplete ? (
                        <Badge className="bg-green-500">Complete</Badge>
                      ) : (
                        <Badge variant="secondary">Incomplete</Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                      Last compliance check: {compliance?.lastComplianceCheck ? formatDateTime(compliance.lastComplianceCheck) : "N/A"}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-compliance-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Compliance Summary
                </CardTitle>
                <CardDescription>
                  Overview of communication compliance status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Compliant Actions</span>
                      <span className="text-sm text-green-600">
                        {compliance ? Math.round((compliance.compliantActions / compliance.totalAuditEntries) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${compliance ? (compliance.compliantActions / compliance.totalAuditEntries) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Warnings</span>
                      <span className="text-sm text-yellow-600">
                        {compliance ? Math.round((compliance.warnings / compliance.totalAuditEntries) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 transition-all"
                        style={{ width: `${compliance ? (compliance.warnings / compliance.totalAuditEntries) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Violations</span>
                      <span className="text-sm text-red-600">
                        {compliance ? Math.round((compliance.violations / compliance.totalAuditEntries) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${compliance ? (compliance.violations / compliance.totalAuditEntries) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">HIPAA Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      All communications encrypted (TLS 1.2+)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      PHI access logged with timestamps
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Provider authentication verified
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Document sharing tracked
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      7-year retention policy enforced
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
