import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, Download, FileText, Lock, AlertTriangle,
  Database, Clock, CheckCircle, XCircle, Eye, EyeOff,
  ArrowRightLeft, ClipboardList, Info
} from "lucide-react";

interface TEFCAPreview {
  recordCount: number;
  dateRange: { earliest: string; latest: string } | null;
  statistics: { totalQueries: number; successRate: number; averageResponseTime: number };
  partnerCount: number;
  statusBreakdown: { success: number; error: number; partial: number; timeout: number };
}

interface AuditPreview {
  recordCount: number;
  totalAvailable: number;
  dateRange: { earliest: string; latest: string } | null;
  severityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  phiAccessCount: number;
}

export default function ComplianceExport() {
  const { toast } = useToast();

  const [tefcaFormat, setTefcaFormat] = useState("pdf");
  const [tefcaPassword, setTefcaPassword] = useState("");
  const [tefcaDateFrom, setTefcaDateFrom] = useState("");
  const [tefcaDateTo, setTefcaDateTo] = useState("");
  const [tefcaPartner, setTefcaPartner] = useState("all");
  const [tefcaStatus, setTefcaStatus] = useState("all");
  const [showTefcaPassword, setShowTefcaPassword] = useState(false);

  const [auditFormat, setAuditFormat] = useState("pdf");
  const [auditPassword, setAuditPassword] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditSeverity, setAuditSeverity] = useState("all");
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditPhiOnly, setAuditPhiOnly] = useState(false);
  const [showAuditPassword, setShowAuditPassword] = useState(false);

  const tefcaPreview = useQuery<TEFCAPreview>({
    queryKey: ["/api/compliance-export/preview/tefca"],
  });

  const auditPreview = useQuery<AuditPreview>({
    queryKey: ["/api/compliance-export/preview/audit-logs"],
  });

  const tefcaExport = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/compliance-export/tefca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          format: tefcaFormat,
          password: tefcaPassword,
          dateFrom: tefcaDateFrom || undefined,
          dateTo: tefcaDateTo || undefined,
          partner: tefcaPartner !== "all" ? tefcaPartner : undefined,
          status: tefcaStatus !== "all" ? tefcaStatus : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Export failed");
      }

      const iv = response.headers.get("X-Encryption-IV");
      const origExt = response.headers.get("X-Original-Extension") || tefcaFormat;
      const recordCount = response.headers.get("X-Record-Count");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      const a = document.createElement("a");
      a.href = url;
      a.download = `tefca-compliance-export-${timestamp}.${origExt}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { iv, recordCount, format: origExt };
    },
    onSuccess: (data) => {
      toast({
        title: "TEFCA Export Complete",
        description: `Encrypted ${data.format.toUpperCase()} downloaded (${data.recordCount} records). Save the IV for decryption: ${data.iv?.slice(0, 16)}...`,
      });
      setTefcaPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    },
  });

  const auditExport = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/compliance-export/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          format: auditFormat,
          password: auditPassword,
          dateFrom: auditDateFrom || undefined,
          dateTo: auditDateTo || undefined,
          severity: auditSeverity !== "all" ? auditSeverity : undefined,
          category: auditCategory !== "all" ? auditCategory : undefined,
          phiOnly: auditPhiOnly || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Export failed");
      }

      const iv = response.headers.get("X-Encryption-IV");
      const origExt = response.headers.get("X-Original-Extension") || auditFormat;
      const recordCount = response.headers.get("X-Record-Count");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-compliance-export-${timestamp}.${origExt}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { iv, recordCount, format: origExt };
    },
    onSuccess: (data) => {
      toast({
        title: "Audit Log Export Complete",
        description: `Encrypted ${data.format.toUpperCase()} downloaded (${data.recordCount} records). Save the IV for decryption: ${data.iv?.slice(0, 16)}...`,
      });
      setAuditPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    },
  });

  function formatDate(dateStr: string | undefined | null): string {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  const isTefcaReady = tefcaPassword.length >= 8;
  const isAuditReady = auditPassword.length >= 8;

  return (
    <div className="space-y-6" data-testid="compliance-export-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Shield className="h-6 w-6 text-blue-600" />
            Compliance Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Export TEFCA exchange data and system audit logs as encrypted PDF/CSV for compliance reporting
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 px-3 py-1.5">
          <Lock className="h-3.5 w-3.5" />
          AES-256 Encrypted
        </Badge>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
          All exports are encrypted with AES-256-CBC using your chosen password. PHI fields are masked per HIPAA Minimum
          Necessary Standard. Each export is logged to the audit trail. Store the decryption password securely — it is
          never saved by the system.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="tefca" className="w-full">
        <TabsList className="grid w-full grid-cols-2" data-testid="export-tabs">
          <TabsTrigger value="tefca" className="flex items-center gap-2" data-testid="tab-tefca">
            <ArrowRightLeft className="h-4 w-4" />
            TEFCA Exchange Data
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2" data-testid="tab-audit">
            <ClipboardList className="h-4 w-4" />
            System Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tefca" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  Data Preview
                </CardTitle>
                <CardDescription>Available TEFCA exchange records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tefcaPreview.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-4 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : tefcaPreview.data ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Records</span>
                      <span className="font-semibold" data-testid="tefca-record-count">{tefcaPreview.data.recordCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">QHIN Partners</span>
                      <span className="font-semibold">{tefcaPreview.data.partnerCount}</span>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground">Status Breakdown</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        <span>{tefcaPreview.data.statusBreakdown.success} success</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span>{tefcaPreview.data.statusBreakdown.error} errors</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{tefcaPreview.data.statusBreakdown.partial} partial</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-orange-500" />
                        <span>{tefcaPreview.data.statusBreakdown.timeout} timeout</span>
                      </div>
                    </div>
                    {tefcaPreview.data.dateRange && (
                      <>
                        <Separator />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Earliest: {formatDate(tefcaPreview.data.dateRange.earliest)}</div>
                          <div>Latest: {formatDate(tefcaPreview.data.dateRange.latest)}</div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Unable to load preview</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  TEFCA Export Configuration
                </CardTitle>
                <CardDescription>Configure filters and encryption for TEFCA exchange data export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-export-format">Export Format</Label>
                    <Select value={tefcaFormat} onValueChange={setTefcaFormat}>
                      <SelectTrigger id="compliance-export-export-format" data-testid="tefca-format-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Report</SelectItem>
                        <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-filter-by-status">Filter by Status</Label>
                    <Select value={tefcaStatus} onValueChange={setTefcaStatus}>
                      <SelectTrigger id="compliance-export-filter-by-status" data-testid="tefca-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="timeout">Timeout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-date-from">Date From</Label>
                    <Input id="compliance-export-date-from"
                      type="date"
                      value={tefcaDateFrom}
                      onChange={(e) => setTefcaDateFrom(e.target.value)}
                      data-testid="tefca-date-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-date-to">Date To</Label>
                    <Input id="compliance-export-date-to"
                      type="date"
                      value={tefcaDateTo}
                      onChange={(e) => setTefcaDateTo(e.target.value)}
                      data-testid="tefca-date-to"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="compliance-export-encryption-password" className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Encryption Password
                  </Label>
                  <div className="relative">
                    <Input id="compliance-export-encryption-password"
                      type={showTefcaPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={tefcaPassword}
                      onChange={(e) => setTefcaPassword(e.target.value)}
                      className="pr-10"
                      data-testid="tefca-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTefcaPassword(!showTefcaPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="tefca-toggle-password"
                    >
                      {showTefcaPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {tefcaPassword.length > 0 && tefcaPassword.length < 8 && (
                    <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                  )}
                </div>

                <Button
                  onClick={() => tefcaExport.mutate()}
                  disabled={!isTefcaReady || tefcaExport.isPending}
                  className="w-full"
                  data-testid="tefca-export-button"
                >
                  {tefcaExport.isPending ? (
                    <>
                      <Lock className="h-4 w-4 mr-2 animate-spin" />
                      Encrypting & Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Encrypted TEFCA {tefcaFormat.toUpperCase()}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-500" />
                  Data Preview
                </CardTitle>
                <CardDescription>Available system audit records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditPreview.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-4 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : auditPreview.data ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Records</span>
                      <span className="font-semibold" data-testid="audit-record-count">{auditPreview.data.recordCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PHI Access Events</span>
                      <span className="font-semibold text-amber-600">{auditPreview.data.phiAccessCount}</span>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground">Severity Breakdown</div>
                    <div className="space-y-1.5">
                      {Object.entries(auditPreview.data.severityBreakdown).map(([sev, count]) => (
                        <div key={sev} className="flex justify-between text-sm">
                          <Badge
                            variant={sev === "critical" || sev === "error" ? "destructive" : sev === "warning" ? "outline" : "secondary"}
                            className="text-xs"
                          >
                            {sev}
                          </Badge>
                          <span>{count as number}</span>
                        </div>
                      ))}
                    </div>
                    {auditPreview.data.dateRange && (
                      <>
                        <Separator />
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Earliest: {formatDate(auditPreview.data.dateRange.earliest)}</div>
                          <div>Latest: {formatDate(auditPreview.data.dateRange.latest)}</div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Unable to load preview</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-purple-500" />
                  Audit Log Export Configuration
                </CardTitle>
                <CardDescription>Configure filters and encryption for system audit log export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-export-format-2">Export Format</Label>
                    <Select value={auditFormat} onValueChange={setAuditFormat}>
                      <SelectTrigger id="compliance-export-export-format-2" data-testid="audit-format-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Report</SelectItem>
                        <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-filter-by-severity">Filter by Severity</Label>
                    <Select value={auditSeverity} onValueChange={setAuditSeverity}>
                      <SelectTrigger id="compliance-export-filter-by-severity" data-testid="audit-severity-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-date-from-2">Date From</Label>
                    <Input id="compliance-export-date-from-2"
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      data-testid="audit-date-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-date-to-2">Date To</Label>
                    <Input id="compliance-export-date-to-2"
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      data-testid="audit-date-to"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-filter-by-category">Filter by Category</Label>
                    <Select value={auditCategory} onValueChange={setAuditCategory}>
                      <SelectTrigger id="compliance-export-filter-by-category" data-testid="audit-category-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="data_source">Data Source</SelectItem>
                        <SelectItem value="configuration">Configuration</SelectItem>
                        <SelectItem value="rule_execution">Rule Execution</SelectItem>
                        <SelectItem value="ai_prediction">AI Prediction</SelectItem>
                        <SelectItem value="user_management">User Management</SelectItem>
                        <SelectItem value="access_control">Access Control</SelectItem>
                        <SelectItem value="patient_record">Patient Record</SelectItem>
                        <SelectItem value="system_event">System Event</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compliance-export-phi-access-filter">PHI Access Filter</Label>
                    <Select value={auditPhiOnly ? "phi" : "all"} onValueChange={(v) => setAuditPhiOnly(v === "phi")}>
                      <SelectTrigger id="compliance-export-phi-access-filter" data-testid="audit-phi-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="phi">PHI Access Events Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="compliance-export-encryption-password-2" className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Encryption Password
                  </Label>
                  <div className="relative">
                    <Input id="compliance-export-encryption-password-2"
                      type={showAuditPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={auditPassword}
                      onChange={(e) => setAuditPassword(e.target.value)}
                      className="pr-10"
                      data-testid="audit-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuditPassword(!showAuditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="audit-toggle-password"
                    >
                      {showAuditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {auditPassword.length > 0 && auditPassword.length < 8 && (
                    <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                  )}
                </div>

                <Button
                  onClick={() => auditExport.mutate()}
                  disabled={!isAuditReady || auditExport.isPending}
                  className="w-full"
                  data-testid="audit-export-button"
                >
                  {auditExport.isPending ? (
                    <>
                      <Lock className="h-4 w-4 mr-2 animate-spin" />
                      Encrypting & Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Encrypted Audit Log {auditFormat.toUpperCase()}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Decryption Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Downloaded files are AES-256-CBC encrypted. To decrypt, use OpenSSL:</p>
            <code className="block bg-muted px-3 py-2 rounded text-xs font-mono">
              openssl enc -d -aes-256-cbc -in export-file.pdf.enc -out report.pdf -pass pass:YOUR_PASSWORD -iv YOUR_IV -pbkdf2
            </code>
            <p className="text-xs">
              The initialization vector (IV) is included in the download response headers and displayed in the success
              notification. Store both the password and IV securely per your organization's key management policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
