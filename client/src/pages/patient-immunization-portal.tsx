import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Syringe, 
  Shield, 
  Mail, 
  FileCheck, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  Archive,
  Link,
  Info,
  MapPin,
  Calendar,
  Building2,
  User,
  ChevronRight,
  Lock
} from "lucide-react";
import type { 
  PatientImmunizationPortalSummary, 
  Immunization,
  IISConsent,
  IISConnectionState,
  PatientPortalMessage,
} from "@shared/schema";

interface PortalSummaryResponse {
  data: PatientImmunizationPortalSummary;
  disclaimer: string;
}

interface ImmunizationsResponse {
  data: Immunization[];
  disclaimer: string;
}

interface IISConnectionsResponse {
  data: {
    connections: IISConnectionState[];
    availableStates: { code: string; name: string; requiresConsent: boolean }[];
  };
  disclaimer: string;
}

interface ConsentsResponse {
  data: IISConsent[];
  disclaimer: string;
}

interface MessagesResponse {
  data: PatientPortalMessage[];
  unreadCount: number;
  disclaimer: string;
}

export default function PatientImmunizationPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMessage, setSelectedMessage] = useState<PatientPortalMessage | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<IISConsent | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [consentType, setConsentType] = useState("full_access");
  const [revokeReason, setRevokeReason] = useState("");

  const { data: summaryData, isLoading: summaryLoading } = useQuery<PortalSummaryResponse>({
    queryKey: ["/api/patient-immunization-portal/summary"]
  });

  const { data: immunizationsData, isLoading: immunizationsLoading } = useQuery<ImmunizationsResponse>({
    queryKey: ["/api/patient-immunization-portal/immunizations"]
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery<IISConnectionsResponse>({
    queryKey: ["/api/patient-immunization-portal/iis-connections"]
  });

  const { data: consentsData, isLoading: consentsLoading } = useQuery<ConsentsResponse>({
    queryKey: ["/api/patient-immunization-portal/consents"]
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<MessagesResponse>({
    queryKey: ["/api/patient-immunization-portal/messages"]
  });

  const grantConsentMutation = useMutation({
    mutationFn: async ({ stateCode, consentType }: { stateCode: string; consentType: string }) => {
      return apiRequest("POST", "/api/patient-immunization-portal/consents", {
        stateCode,
        consentType,
        iisSystemName: connectionsData?.data.availableStates.find(s => s.code === stateCode)?.name || stateCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/consents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/iis-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/summary"] });
      toast({ title: "Consent Granted", description: "Your IIS connection consent has been recorded." });
      setShowConsentDialog(false);
      setSelectedStateCode("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to grant consent. Please try again.", variant: "destructive" });
    }
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async ({ consentId, reason }: { consentId: string; reason: string }) => {
      return apiRequest("POST", `/api/patient-immunization-portal/consents/${consentId}/revoke`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/consents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/iis-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/summary"] });
      toast({ title: "Consent Revoked", description: "Your IIS connection consent has been revoked." });
      setShowRevokeDialog(false);
      setSelectedConsent(null);
      setRevokeReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke consent. Please try again.", variant: "destructive" });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/patient-immunization-portal/messages/${messageId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/summary"] });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/patient-immunization-portal/messages/${messageId}/archive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-immunization-portal/messages"] });
      toast({ title: "Message Archived", description: "The message has been archived." });
      setSelectedMessage(null);
    }
  });

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid="badge-status-connected"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
      case "pending_verification":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "disconnected":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100" data-testid="badge-status-disconnected"><XCircle className="w-3 h-3 mr-1" />Disconnected</Badge>;
      case "error":
        return <Badge variant="destructive" data-testid="badge-status-error"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">{status}</Badge>;
    }
  };

  const getConsentStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid="badge-consent-active"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case "revoked":
        return <Badge variant="destructive" data-testid="badge-consent-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      case "expired":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100" data-testid="badge-consent-expired"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-consent-unknown">{status}</Badge>;
    }
  };

  const getMessagePriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive" data-testid="badge-priority-urgent">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" data-testid="badge-priority-high">High</Badge>;
      case "normal":
        return <Badge variant="outline" data-testid="badge-priority-normal">Normal</Badge>;
      case "low":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100" data-testid="badge-priority-low">Low</Badge>;
      default:
        return null;
    }
  };

  const handleViewMessage = (message: PatientPortalMessage) => {
    setSelectedMessage(message);
    if (message.status === "unread") {
      markReadMutation.mutate(message.id);
    }
  };

  const summary = summaryData?.data;

  return (
    <div className="container mx-auto p-4 max-w-6xl" data-testid="patient-immunization-portal">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Lock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-portal-title">Patient Immunization Portal</h1>
        </div>
        <p className="text-muted-foreground">
          View your immunization records, manage IIS connections, and communicate with your care team securely.
        </p>
      </div>

      <Alert className="mb-6" data-testid="alert-disclaimer">
        <Info className="h-4 w-4" />
        <AlertTitle>Important Information</AlertTitle>
        <AlertDescription>
          This portal provides informational access to your immunization records. It does not provide medical advice, 
          diagnoses, or treatment recommendations. Always consult with your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 gap-1 w-full" data-testid="tabs-navigation">
          <TabsTrigger value="dashboard" className="flex items-center gap-2" data-testid="tab-dashboard">
            <Syringe className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-2" data-testid="tab-records">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Records</span>
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2" data-testid="tab-connections">
            <Link className="h-4 w-4" />
            <span className="hidden sm:inline">IIS Status</span>
          </TabsTrigger>
          <TabsTrigger value="consent" className="flex items-center gap-2" data-testid="tab-consent">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Consent</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2 relative" data-testid="tab-messages">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
            {messagesData && messagesData.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" data-testid="badge-unread-count">
                {messagesData.unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4" data-testid="content-dashboard">
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="card-immunizations-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Immunization Records</CardTitle>
                    <Syringe className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-immunizations">{summary?.immunizations.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {summary?.immunizations.upToDate || 0} up to date
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-iis-connections-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">IIS Connections</CardTitle>
                    <Link className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-connected-states">{summary?.iisConnections.connectedStates.length || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {summary?.iisConnections.activeConsents || 0} active consents
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-messages-summary">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Secure Messages</CardTitle>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-unread-messages">{summary?.messages.unread || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      unread messages
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-recent-immunizations">
                <CardHeader>
                  <CardTitle>Recent Immunizations</CardTitle>
                  <CardDescription>Your most recent vaccination records</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary?.immunizations.records.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No immunization records found.</p>
                  ) : (
                    <div className="space-y-3">
                      {summary?.immunizations.records.slice(0, 3).map((imm) => (
                        <div key={imm.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`row-immunization-${imm.id}`}>
                          <div className="flex items-center gap-3">
                            <Syringe className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{imm.vaccineName}</p>
                              <p className="text-sm text-muted-foreground">
                                {imm.administeredDate ? new Date(imm.administeredDate).toLocaleDateString() : "N/A"}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{imm.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => setActiveTab("records")}
                    data-testid="button-view-all-records"
                  >
                    View All Records <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4" data-testid="content-records">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Immunization Records
              </CardTitle>
              <CardDescription>Complete history of your vaccinations</CardDescription>
            </CardHeader>
            <CardContent>
              {immunizationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : immunizationsData?.data.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No immunization records found.</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {immunizationsData?.data.map((imm) => (
                      <Card key={imm.id} className="p-4" data-testid={`card-immunization-${imm.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Syringe className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{imm.vaccineName}</h4>
                              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  {imm.administeredDate ? new Date(imm.administeredDate).toLocaleDateString() : "N/A"}
                                </div>
                                {imm.manufacturer && (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3 w-3" />
                                    {imm.manufacturer}
                                  </div>
                                )}
                                {imm.lotNumber && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">Lot: {imm.lotNumber}</span>
                                  </div>
                                )}
                                {imm.doseNumber && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">Dose #{imm.doseNumber}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{imm.status}</Badge>
                            {imm.vaccineCode && (
                              <Badge variant="secondary">CVX: {imm.vaccineCode}</Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4" data-testid="content-connections">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                IIS Connection Status
              </CardTitle>
              <CardDescription>Your connections to State Immunization Information Systems</CardDescription>
            </CardHeader>
            <CardContent>
              {connectionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (
                <>
                  {connectionsData?.data.connections.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No IIS connections established yet.</p>
                      <Button onClick={() => setActiveTab("consent")} data-testid="button-setup-connection">
                        Set Up Connection
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {connectionsData?.data.connections.map((conn) => (
                        <Card key={conn.id} className="p-4" data-testid={`card-connection-${conn.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <MapPin className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-medium">{conn.iisSystemName}</h4>
                                <p className="text-sm text-muted-foreground">State: {conn.stateCode}</p>
                                {conn.lastSyncAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Last synced: {new Date(conn.lastSyncAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getConnectionStatusBadge(conn.status)}
                              {conn.recordsCount !== undefined && (
                                <Badge variant="outline">{conn.recordsCount} records</Badge>
                              )}
                            </div>
                          </div>
                          {conn.errorMessage && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{conn.errorMessage}</AlertDescription>
                            </Alert>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Available State IIS Systems</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {connectionsData?.data.availableStates.filter(s => s.requiresConsent).slice(0, 6).map((state) => (
                        <Button 
                          key={state.code} 
                          variant="outline" 
                          className="justify-start"
                          onClick={() => {
                            setSelectedStateCode(state.code);
                            setShowConsentDialog(true);
                          }}
                          data-testid={`button-connect-${state.code}`}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          {state.code} - {state.name.split(" ")[0]}...
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent" className="space-y-4" data-testid="content-consent">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Consent Management
                  </CardTitle>
                  <CardDescription>Manage your IIS data sharing consents</CardDescription>
                </div>
                <Button onClick={() => setShowConsentDialog(true)} data-testid="button-grant-new-consent">
                  Grant New Consent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : consentsData?.data.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No consent records found.</p>
                  <Button onClick={() => setShowConsentDialog(true)} data-testid="button-grant-first-consent">
                    Grant Your First Consent
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {consentsData?.data.map((consent) => (
                    <Card key={consent.id} className="p-4" data-testid={`card-consent-${consent.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Shield className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{consent.iisSystemName}</h4>
                            <p className="text-sm text-muted-foreground">
                              Consent Type: {consent.consentType.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Granted: {new Date(consent.grantedAt).toLocaleDateString()}
                            </p>
                            {consent.expiresAt && (
                              <p className="text-sm text-muted-foreground">
                                Expires: {new Date(consent.expiresAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getConsentStatusBadge(consent.status)}
                          {consent.status === "active" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedConsent(consent);
                                setShowRevokeDialog(true);
                              }}
                              data-testid={`button-revoke-${consent.id}`}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4" data-testid="content-messages">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Messages
                </CardTitle>
                <CardDescription>
                  {messagesData?.unreadCount || 0} unread
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {messagesLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : messagesData?.data.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No messages yet.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="divide-y">
                      {messagesData?.data.map((msg) => (
                        <button
                          key={msg.id}
                          className={`w-full p-4 text-left hover-elevate ${
                            msg.status === "unread" ? "bg-primary/5" : ""
                          } ${selectedMessage?.id === msg.id ? "bg-primary/10" : ""}`}
                          onClick={() => handleViewMessage(msg)}
                          data-testid={`button-message-${msg.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${msg.status === "unread" ? "bg-primary" : "bg-muted"}`}>
                              <User className={`h-4 w-4 ${msg.status === "unread" ? "text-primary-foreground" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`font-medium truncate ${msg.status === "unread" ? "" : "text-muted-foreground"}`}>
                                  {msg.senderName}
                                </p>
                                {getMessagePriorityBadge(msg.priority)}
                              </div>
                              <p className="text-sm font-medium truncate">{msg.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                {selectedMessage ? (
                  <div className="space-y-4" data-testid="message-detail-view">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{selectedMessage.subject}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{selectedMessage.category.replace(/_/g, " ")}</Badge>
                          {getMessagePriorityBadge(selectedMessage.priority)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => archiveMutation.mutate(selectedMessage.id)}
                          disabled={archiveMutation.isPending}
                          data-testid="button-archive-message"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 py-3 border-y">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedMessage.senderName}</p>
                        <p className="text-sm text-muted-foreground">{selectedMessage.senderRole}</p>
                      </div>
                      <div className="ml-auto text-sm text-muted-foreground">
                        {new Date(selectedMessage.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground" data-testid="message-placeholder">
                    <div className="text-center">
                      <Eye className="h-12 w-12 mx-auto mb-4" />
                      <p>Select a message to view</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent data-testid="dialog-grant-consent">
          <DialogHeader>
            <DialogTitle>Grant IIS Consent</DialogTitle>
            <DialogDescription>
              Allow Tabula Medica to connect to a State Immunization Information System on your behalf.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="patient-immunization-por-select-state">Select State</Label>
              <Select value={selectedStateCode} onValueChange={setSelectedStateCode}>
                <SelectTrigger id="patient-immunization-por-select-state" data-testid="select-state">
                  <SelectValue placeholder="Choose a state..." />
                </SelectTrigger>
                <SelectContent>
                  {connectionsData?.data.availableStates.filter(s => s.requiresConsent).map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.code} - {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-immunization-por-consent-type">Consent Type</Label>
              <Select value={consentType} onValueChange={setConsentType}>
                <SelectTrigger id="patient-immunization-por-consent-type" data-testid="select-consent-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_access">Full Access - View and share records</SelectItem>
                  <SelectItem value="view_only">View Only - Just view records</SelectItem>
                  <SelectItem value="share_with_providers">Share with Providers - Allow care team access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                By granting consent, you authorize Tabula Medica to retrieve and display your immunization records 
                from the selected State IIS. You can revoke this consent at any time.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentDialog(false)} data-testid="button-cancel-consent">
              Cancel
            </Button>
            <Button 
              onClick={() => grantConsentMutation.mutate({ stateCode: selectedStateCode, consentType })}
              disabled={!selectedStateCode || grantConsentMutation.isPending}
              data-testid="button-confirm-consent"
            >
              {grantConsentMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Granting...
                </>
              ) : (
                "Grant Consent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent data-testid="dialog-revoke-consent">
          <DialogHeader>
            <DialogTitle>Revoke Consent</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke your consent for {selectedConsent?.iisSystemName}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="patient-immunization-por-reason-for-revoking-optional">Reason for Revoking (Optional)</Label>
              <Textarea id="patient-immunization-por-reason-for-revoking-optional" 
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Please let us know why you're revoking consent..."
                data-testid="input-revoke-reason"
              />
            </div>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Revoking consent will disconnect your records from this State IIS. 
                You will no longer receive automatic updates from this registry.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)} data-testid="button-cancel-revoke">
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedConsent && revokeConsentMutation.mutate({ 
                consentId: selectedConsent.id, 
                reason: revokeReason 
              })}
              disabled={revokeConsentMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeConsentMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Consent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-patient-immunization-portal-disclaimer" />
    </div>
  );
}