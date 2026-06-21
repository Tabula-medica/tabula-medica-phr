import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  AlertTriangle,
  Eye,
  FileText,
  Users,
  Clock,
  Activity,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Building2,
  User,
  Stethoscope,
  ClipboardList
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface ClinicianAuditEntry {
  id: string;
  timestamp: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string;
  department?: string;
  patientId: string;
  patientName: string;
  patientMrn?: string;
  action: string;
  actionDescription: string;
  resourceType: string;
  accessContext: {
    emergencyAccess: boolean;
    breakGlass: boolean;
    careTeamMember?: boolean;
  };
  hipaaCompliance: {
    flagged: boolean;
    flagReason?: string;
  };
  sessionInfo: {
    ipAddress: string;
    deviceType: string;
  };
  outcome: string;
}

interface AuditDashboard {
  overview: {
    totalAuditEvents: number;
    totalClinicians: number;
    totalPatientsAccessed: number;
    emergencyAccessCount: number;
    breakGlassCount: number;
    flaggedEvents: number;
    complianceRate: number;
  };
  recentEvents: ClinicianAuditEntry[];
  topAccessors: {
    clinicianId: string;
    clinicianName: string;
    accessCount: number;
    uniquePatients: number;
  }[];
  departmentBreakdown: {
    department: string;
    accessCount: number;
    clinicianCount: number;
  }[];
  complianceAlerts: {
    id: string;
    severity: string;
    type: string;
    description: string;
    clinicianName: string;
    timestamp: string;
    resolved: boolean;
  }[];
}

function getActionIcon(action: string) {
  switch (action) {
    case "patient_record_view": return <Eye className="h-4 w-4" />;
    case "patient_record_edit": return <FileText className="h-4 w-4" />;
    case "medication_prescribe": return <Stethoscope className="h-4 w-4" />;
    case "lab_review": return <ClipboardList className="h-4 w-4" />;
    case "break_glass": return <AlertTriangle className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function getSeverityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
    case "high": return "destructive";
    case "medium": return "default";
    default: return "secondary";
  }
}

export default function ClinicianAuditView() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const { data: dashboard, isLoading } = useQuery<AuditDashboard>({
    queryKey: ["/api/clinician-audit/dashboard"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/clinician-audit/export", {});
    },
    onSuccess: () => {
      toast({ title: "Audit report exported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to export report", variant: "destructive" });
    }
  });

  const filteredEvents = dashboard?.recentEvents?.filter(event => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!event.clinicianName.toLowerCase().includes(search) &&
          !event.patientName.toLowerCase().includes(search) &&
          !event.action.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (actionFilter !== "all" && event.action !== actionFilter) {
      return false;
    }
    if (flaggedOnly && !event.hipaaCompliance.flagged) {
      return false;
    }
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const overview = dashboard?.overview;

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Shield className="h-8 w-8" />
              Clinician Audit View
            </h1>
            <p className="text-muted-foreground">
              HIPAA-compliant audit trail for clinician access to patient records
            </p>
          </div>
          <Button 
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-events">
                {overview?.totalAuditEvents || 0}
              </div>
              <p className="text-xs text-muted-foreground">audit entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clinicians
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-clinicians">
                {overview?.totalClinicians || 0}
              </div>
              <p className="text-xs text-muted-foreground">active clinicians</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Break-Glass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-break-glass">
                {overview?.breakGlassCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">emergency accesses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-compliance-rate">
                {overview?.complianceRate?.toFixed(1) || 0}%
              </div>
              <Progress value={overview?.complianceRate || 0} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        {dashboard?.complianceAlerts && dashboard.complianceAlerts.filter(a => !a.resolved).length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Compliance Alerts</AlertTitle>
            <AlertDescription>
              {dashboard.complianceAlerts.filter(a => !a.resolved).length} unresolved alerts require attention
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="events" data-testid="tab-events">
              <FileText className="h-4 w-4 mr-2 hidden sm:inline" />
              Events
            </TabsTrigger>
            <TabsTrigger value="clinicians" data-testid="tab-clinicians">
              <User className="h-4 w-4 mr-2 hidden sm:inline" />
              Clinicians
            </TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">
              <Building2 className="h-4 w-4 mr-2 hidden sm:inline" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertCircle className="h-4 w-4 mr-2 hidden sm:inline" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clinician, patient, or action..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48" data-testid="select-action-filter">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="patient_record_view">Record View</SelectItem>
                  <SelectItem value="patient_record_edit">Record Edit</SelectItem>
                  <SelectItem value="medication_prescribe">Prescribe</SelectItem>
                  <SelectItem value="lab_review">Lab Review</SelectItem>
                  <SelectItem value="break_glass">Break-Glass</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={flaggedOnly ? "default" : "outline"}
                onClick={() => setFlaggedOnly(!flaggedOnly)}
                data-testid="button-flagged-filter"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Flagged Only
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Clinician</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No audit entries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEvents.slice(0, 15).map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="text-sm">
                            <div>{format(new Date(event.timestamp), "MMM d, h:mm a")}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{event.clinicianName}</div>
                            <div className="text-xs text-muted-foreground">{event.clinicianRole}</div>
                          </TableCell>
                          <TableCell>
                            <div>{event.patientName}</div>
                            <div className="text-xs text-muted-foreground">{event.patientMrn}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(event.action)}
                              <span className="text-sm">{event.actionDescription}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {event.accessContext.breakGlass && (
                                <Badge variant="destructive">Break-Glass</Badge>
                              )}
                              {event.accessContext.emergencyAccess && !event.accessContext.breakGlass && (
                                <Badge variant="default">Emergency</Badge>
                              )}
                              {event.hipaaCompliance.flagged && (
                                <Badge variant="destructive">Flagged</Badge>
                              )}
                              {!event.accessContext.breakGlass && !event.hipaaCompliance.flagged && (
                                <Badge variant="secondary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Normal
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinicians" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Top Clinician Activity</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard?.topAccessors?.map((clinician) => (
                <Card key={clinician.clinicianId} data-testid={`card-clinician-${clinician.clinicianId}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {clinician.clinicianName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Accesses</p>
                        <p className="text-xl font-bold">{clinician.accessCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unique Patients</p>
                        <p className="text-xl font-bold">{clinician.uniquePatients}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Department Breakdown</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboard?.departmentBreakdown?.map((dept) => (
                <Card key={dept.department} data-testid={`card-dept-${dept.department}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {dept.department}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Access Count</p>
                        <p className="text-xl font-bold">{dept.accessCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Clinicians</p>
                        <p className="text-xl font-bold">{dept.clinicianCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Compliance Alerts</h3>
            {dashboard?.complianceAlerts?.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  No compliance alerts at this time
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {dashboard?.complianceAlerts?.map((alert) => (
                  <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <CardTitle className="text-base">{alert.type}</CardTitle>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={getSeverityVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant={alert.resolved ? "secondary" : "outline"}>
                            {alert.resolved ? "Resolved" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Clinician: </span>
                          <span className="font-medium">{alert.clinicianName}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time: </span>
                          <span>{format(new Date(alert.timestamp), "MMM d, h:mm a")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
