import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Shield, 
  Download, 
  FileText, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Lock,
  Eye,
  Settings,
  History,
  FileDown,
  UserCheck,
  FileCheck
} from "lucide-react";

interface ExportPolicy {
  id: string;
  name: string;
  description: string;
  allowedFormats: string[];
  allowedDataTypes: string[];
  allowedRoles: string[];
  requiresApproval: boolean;
  approverRoles: string[];
  maxRecordsPerExport: number;
  retentionDays: number;
  requiresMfa: boolean;
  allowBulkExport: boolean;
  redactSensitive: boolean;
  watermarkExports: boolean;
  auditRequired: boolean;
  isActive: boolean;
}

interface ExportRequest {
  id: string;
  requesterId: string;
  requesterRole: string;
  patientId: string;
  format: string;
  dataTypes: string[];
  purpose: string;
  status: string;
  approverId?: string;
  approvalDate?: string;
  denialReason?: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt?: string;
  createdAt: string;
}

interface ExportAuditEntry {
  id: string;
  exportRequestId: string;
  action: string;
  performedBy: string;
  performedByRole: string;
  details: string;
  timestamp: string;
}

interface RolePermissions {
  role: string;
  permissions: string[];
  totalPermissions: number;
}

export default function ExportControlPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [exportFormat, setExportFormat] = useState("pdf");

  const { data: myPolicy } = useQuery<{ role: string; policy: ExportPolicy }>({
    queryKey: ["/api/export-control/my-policy"],
  });

  const { data: exportRequests, isLoading: requestsLoading } = useQuery<ExportRequest[]>({
    queryKey: ["/api/export-control/requests"],
  });

  const { data: rolePermissions } = useQuery<RolePermissions[]>({
    queryKey: ["/api/export-control/permissions"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: { patientId: string; format: string; dataTypes: string[]; purpose: string }) => {
      const response = await apiRequest("POST", "/api/export-control/requests", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Export request created" });
      queryClient.invalidateQueries({ queryKey: ["/api/export-control/requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/export-control/requests/${id}/approve`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Request approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/export-control/requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const denyRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/export-control/requests/${id}/deny`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Request denied" });
      queryClient.invalidateQueries({ queryKey: ["/api/export-control/requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const downloadExportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/export-control/requests/${id}/download`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Export download initiated" });
      queryClient.invalidateQueries({ queryKey: ["/api/export-control/requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500" data-testid="badge-status-approved"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "denied":
        return <Badge variant="destructive" data-testid="badge-status-denied"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case "completed":
        return <Badge className="bg-blue-500" data-testid="badge-status-completed"><FileCheck className="w-3 h-3 mr-1" />Completed</Badge>;
      case "expired":
        return <Badge variant="outline" data-testid="badge-status-expired"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLabel = (format: string) => {
    const labels: Record<string, string> = {
      pdf: "PDF Document",
      fhir: "FHIR R4",
      csv: "CSV Spreadsheet",
      json: "JSON Data",
      ccd: "CCD/C-CDA",
    };
    return labels[format] || format.toUpperCase();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="export-control-page">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Data Export Control</h1>
          <p className="text-muted-foreground">Manage data export policies, requests, and compliance</p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} data-testid="export-tabs">
        <TabsList className="grid w-full grid-cols-4 mb-6" data-testid="export-tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Eye className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">
            <FileDown className="w-4 h-4 mr-2" />
            Export Requests
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">
            <Settings className="w-4 h-4 mr-2" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" data-testid="content-overview">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card data-testid="card-my-policy">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Your Export Policy
                </CardTitle>
                <CardDescription>Current permissions based on your role</CardDescription>
              </CardHeader>
              <CardContent>
                {myPolicy?.policy ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">Role</span>
                      <Badge variant="outline">{myPolicy.role}</Badge>
                    </div>
                    <Separator />
                    <div>
                      <span className="text-sm font-medium">Allowed Formats</span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {myPolicy.policy.allowedFormats.map((format) => (
                          <Badge key={format} variant="secondary" className="text-xs">
                            {formatLabel(format)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Data Types</span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {myPolicy.policy.allowedDataTypes.slice(0, 5).map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {myPolicy.policy.allowedDataTypes.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{myPolicy.policy.allowedDataTypes.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        {myPolicy.policy.requiresApproval ? (
                          <Lock className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span>{myPolicy.policy.requiresApproval ? "Needs Approval" : "Auto-Approved"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{myPolicy.policy.retentionDays}d retention</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        <span>Max {myPolicy.policy.maxRecordsPerExport} records</span>
                      </div>
                      {myPolicy.policy.requiresMfa && (
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>MFA Required</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading policy...</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-role-permissions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Export Permissions by Role
                </CardTitle>
                <CardDescription>Role-based export access controls</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-4">
                    {rolePermissions?.map((rp) => (
                      <div key={rp.role} className="space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize">{rp.role}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {rp.permissions.length} export perms
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rp.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {perm.replace("export:", "")}
                            </Badge>
                          ))}
                        </div>
                        <Separator />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-quick-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Export Statistics
                </CardTitle>
                <CardDescription>Recent export activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Requests</span>
                    <span className="text-2xl font-bold">{exportRequests?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="text-xl font-semibold text-amber-500">
                      {exportRequests?.filter((r) => r.status === "pending").length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Approved</span>
                    <span className="text-xl font-semibold text-green-500">
                      {exportRequests?.filter((r) => r.status === "approved").length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Denied</span>
                    <span className="text-xl font-semibold text-red-500">
                      {exportRequests?.filter((r) => r.status === "denied").length || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6" data-testid="card-new-request">
            <CardHeader>
              <CardTitle>Request New Export</CardTitle>
              <CardDescription>Submit a data export request</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createRequestMutation.mutate({
                    patientId: formData.get("patientId") as string,
                    format: exportFormat,
                    dataTypes: (formData.get("dataTypes") as string).split(",").map((s) => s.trim()),
                    purpose: formData.get("purpose") as string,
                  });
                }}
                className="grid gap-4 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="patientId">Patient ID</Label>
                  <Input
                    id="patientId"
                    name="patientId"
                    placeholder="Enter patient ID"
                    defaultValue="patient_001"
                    data-testid="input-patient-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger data-testid="select-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="fhir">FHIR R4</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      <SelectItem value="json">JSON Data</SelectItem>
                      <SelectItem value="ccd">CCD/C-CDA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataTypes">Data Types (comma-separated)</Label>
                  <Input
                    id="dataTypes"
                    name="dataTypes"
                    placeholder="medications, conditions, allergies"
                    defaultValue="all"
                    data-testid="input-data-types"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="purpose">Purpose of Export</Label>
                  <Textarea
                    id="purpose"
                    name="purpose"
                    placeholder="Describe the purpose of this data export request..."
                    className="min-h-[80px]"
                    data-testid="textarea-purpose"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button 
                    type="submit" 
                    disabled={createRequestMutation.isPending}
                    data-testid="btn-submit-request"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    {createRequestMutation.isPending ? "Submitting..." : "Submit Export Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" data-testid="content-requests">
          <Card>
            <CardHeader>
              <CardTitle>Export Requests</CardTitle>
              <CardDescription>View and manage data export requests</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <p className="text-muted-foreground">Loading requests...</p>
              ) : exportRequests?.length === 0 ? (
                <p className="text-muted-foreground">No export requests found</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {exportRequests?.map((request) => (
                      <Card key={request.id} data-testid={`request-card-${request.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getStatusBadge(request.status)}
                                <Badge variant="outline">{formatLabel(request.format)}</Badge>
                                <Badge variant="secondary">{request.requesterRole}</Badge>
                              </div>
                              <p className="text-sm font-medium">Patient: {request.patientId}</p>
                              <p className="text-sm text-muted-foreground">{request.purpose}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                <span>Created: {new Date(request.createdAt).toLocaleDateString()}</span>
                                {request.expiresAt && (
                                  <span>Expires: {new Date(request.expiresAt).toLocaleDateString()}</span>
                                )}
                                <span>
                                  Downloads: {request.downloadCount}/{request.maxDownloads}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {request.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approveRequestMutation.mutate(request.id)}
                                    disabled={approveRequestMutation.isPending}
                                    data-testid={`btn-approve-${request.id}`}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => denyRequestMutation.mutate({ id: request.id, reason: "Not authorized" })}
                                    disabled={denyRequestMutation.isPending}
                                    data-testid={`btn-deny-${request.id}`}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Deny
                                  </Button>
                                </>
                              )}
                              {(request.status === "approved" || request.status === "completed") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadExportMutation.mutate(request.id)}
                                  disabled={
                                    downloadExportMutation.isPending ||
                                    request.downloadCount >= request.maxDownloads
                                  }
                                  data-testid={`btn-download-${request.id}`}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </div>
                          {request.denialReason && (
                            <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                              Denial reason: {request.denialReason}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" data-testid="content-policies">
          <Card>
            <CardHeader>
              <CardTitle>Default Export Policies</CardTitle>
              <CardDescription>Role-based export policies applied to users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {["patient", "caregiver", "provider", "support", "admin"].map((role) => (
                  <Card key={role} data-testid={`policy-card-${role}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg capitalize">{role}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Approval Required</span>
                        <Switch
                          checked={role === "caregiver" || role === "support"}
                          disabled
                          data-testid={`switch-approval-${role}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>MFA Required</span>
                        <Switch
                          checked={role === "admin" || role === "caregiver" || role === "support"}
                          disabled
                          data-testid={`switch-mfa-${role}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Bulk Export</span>
                        <Switch checked={role === "admin"} disabled data-testid={`switch-bulk-${role}`} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Redact Sensitive</span>
                        <Switch
                          checked={role === "caregiver" || role === "support"}
                          disabled
                          data-testid={`switch-redact-${role}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Watermark</span>
                        <Switch
                          checked={role !== "patient"}
                          disabled
                          data-testid={`switch-watermark-${role}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" data-testid="content-audit">
          <Card>
            <CardHeader>
              <CardTitle>Export Audit Log</CardTitle>
              <CardDescription>Track all export-related activities for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {exportRequests?.slice(0, 10).map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 border rounded flex-wrap gap-2"
                    data-testid={`audit-entry-${request.id}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {request.status === "approved" ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : request.status === "denied" ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          Export request {request.status} for patient {request.patientId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By {request.requesterRole} - {request.format} format
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {(!exportRequests || exportRequests.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">No audit entries found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
