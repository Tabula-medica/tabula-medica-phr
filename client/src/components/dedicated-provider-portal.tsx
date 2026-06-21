import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  LongTermVitalsTrend,
  LongTermLabsTrend,
  MedicationAdherencePattern,
  PatientGeographicMap,
  CustomizableDashboard,
  defaultDashboardWidgets,
  generateSampleVitalsData,
  generateSampleLabsData,
  generateSampleAdherenceData,
  generateSampleLocationData,
} from "@/components/advanced-health-visualizations";
import {
  Users,
  Activity,
  AlertTriangle,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Database,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ChevronRight,
  Heart,
  Pill,
  Stethoscope,
  FlaskConical,
  Shield,
  RefreshCw,
  Search,
  Filter,
  Info,
  BarChart3,
} from "lucide-react";

interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  criticalAlerts: number;
  pendingMessages: number;
  pendingResults: number;
  appointmentsToday: number;
  carePlansDue: number;
  qualityMetrics: { overallScore: number; trend: string };
  patientDistribution: { riskLevel: string; count: number }[];
}

interface ProviderAlert {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  actionRequired: boolean;
  createdAt: string;
  acknowledgedAt?: string;
}

interface Patient {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  dataQualityScore: number;
}

interface AggregatedPatientData {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  demographics: {
    age: number;
    gender: string;
    phone?: string;
    preferredLanguage: string;
  };
  dataSources: ConnectedDataSource[];
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  vitalSigns: VitalSign[];
  labResults: LabResult[];
  dataQualityScore: number;
}

interface ConnectedDataSource {
  id: string;
  sourceType: string;
  sourceName: string;
  organization: string;
  connectionStatus: string;
  lastSyncAt: string;
  recordCount: number;
}

interface Condition {
  id: string;
  display: string;
  clinicalStatus: string;
  severity?: string;
  sources: string[];
}

interface Medication {
  id: string;
  display: string;
  dosage: string;
  frequency: string;
  status: string;
  adherenceRate?: number;
}

interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  severity: string;
}

interface VitalSign {
  id: string;
  type: string;
  value: number;
  unit: string;
  interpretation?: string;
}

interface LabResult {
  id: string;
  testName: string;
  value: string;
  unit: string;
  interpretation: string;
  reportedAt: string;
}

interface AIInsights {
  patientId: string;
  generatedAt: string;
  clinicalSummary: string;
  keyFindings: { category: string; finding: string; significance: string }[];
  trends: { metric: string; direction: string; description: string }[];
  riskFactors: { factor: string; level: string; description: string }[];
  gaps: { type: string; description: string; priority: string; recommendation: string }[];
  recommendations: { category: string; title: string; description: string; priority: string }[];
  disclaimer: string;
}

interface Conversation {
  id: string;
  type: string;
  patientId?: string;
  patientName?: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: string;
  priority: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export function DedicatedProviderPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboardWidgets, setDashboardWidgets] = useState(() => {
    const saved = localStorage.getItem("providerDashboardWidgets");
    return saved ? JSON.parse(saved) : defaultDashboardWidgets;
  });

  const [vitalsData] = useState(() => generateSampleVitalsData());
  const [labsData] = useState(() => generateSampleLabsData());
  const [adherenceData] = useState(() => generateSampleAdherenceData());
  const [locationData] = useState(() => generateSampleLocationData());

  useEffect(() => {
    localStorage.setItem("providerDashboardWidgets", JSON.stringify(dashboardWidgets));
  }, [dashboardWidgets]);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["/api/dedicated-provider-portal/dashboard/stats"],
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<{ alerts: ProviderAlert[] }>({
    queryKey: ["/api/dedicated-provider-portal/alerts"],
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery<{ patients: Patient[]; total: number }>({
    queryKey: ["/api/dedicated-provider-portal/patients"],
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/dedicated-provider-portal/conversations"],
  });

  const { data: patientData, isLoading: patientLoading } = useQuery<{ patient: AggregatedPatientData }>({
    queryKey: ["/api/dedicated-provider-portal/patients", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery<{ insights: AIInsights }>({
    queryKey: ["/api/dedicated-provider-portal/patients", selectedPatientId, "ai-insights"],
    enabled: !!selectedPatientId,
  });

  const { data: messagesData } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/dedicated-provider-portal/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiRequest("POST", `/api/dedicated-provider-portal/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dedicated-provider-portal/alerts"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId: string; content: string; recipientId: string }) =>
      apiRequest("POST", `/api/dedicated-provider-portal/conversations/${data.conversationId}/messages`, {
        recipientId: data.recipientId,
        content: data.content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dedicated-provider-portal/conversations", selectedConversationId, "messages"] });
      setNewMessage("");
    },
  });

  const stats = statsData?.stats;
  const alerts = alertsData?.alerts || [];
  const patients = patientsData?.patients || [];
  const conversations = conversationsData?.conversations || [];
  const patient = patientData?.patient;
  const insights = insightsData?.insights;
  const messages = messagesData?.messages || [];

  const filteredPatients = patients.filter(p =>
    p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "warning": return "bg-yellow-500";
      case "moderate": return "bg-amber-500";
      case "info": return "bg-blue-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInterpretationBadge = (interpretation: string) => {
    switch (interpretation) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "low": return <Badge className="bg-yellow-500">Low</Badge>;
      default: return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="provider-portal-container">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-portal-title">Provider Portal</h1>
            <p className="text-muted-foreground">Aggregated patient data with AI-powered insights</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              HIPAA Compliant
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Database className="h-3 w-3" />
              Interoperability Hub
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-12">
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-dashboard">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="patients" className="gap-2" data-testid="tab-patients">
              <Users className="h-4 w-4" />
              Patients
            </TabsTrigger>
            <TabsTrigger value="messaging" className="gap-2" data-testid="tab-messaging">
              <MessageSquare className="h-4 w-4" />
              Messaging
              {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                  {conversations.filter(c => c.unreadCount > 0).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="visualizations" className="gap-2" data-testid="tab-visualizations">
              <BarChart3 className="h-4 w-4" />
              Visualizations
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="dashboard" className="h-full m-0 p-6">
            {statsLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="card-total-patients">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-patients">{stats.totalPatients}</div>
                      <p className="text-xs text-muted-foreground">{stats.activePatients} active</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-critical-alerts">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-500" data-testid="text-critical-alerts">{stats.criticalAlerts}</div>
                      <p className="text-xs text-muted-foreground">Require immediate attention</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-pending-messages">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Messages</CardTitle>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pending-messages">{stats.pendingMessages}</div>
                      <p className="text-xs text-muted-foreground">{stats.pendingResults} pending results</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-quality-score">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-quality-score">{stats.qualityMetrics.overallScore}%</div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {getTrendIcon(stats.qualityMetrics.trend)}
                        {stats.qualityMetrics.trend}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-alerts-section">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Active Alerts
                      </CardTitle>
                      <CardDescription>Alerts requiring your attention</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {alertsLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : alerts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          No active alerts
                        </div>
                      ) : (
                        <ScrollArea className="h-64">
                          <div className="space-y-3">
                            {alerts.map(alert => (
                              <div
                                key={alert.id}
                                className="flex items-start gap-3 p-3 rounded-lg border"
                                data-testid={`alert-item-${alert.id}`}
                              >
                                <div className={`h-2 w-2 mt-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{alert.title}</span>
                                    <Badge variant="outline" className="text-xs">{alert.patientName}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(alert.createdAt).toLocaleString()}
                                    </span>
                                    {!alert.acknowledgedAt && alert.actionRequired && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                                        disabled={acknowledgeMutation.isPending}
                                        data-testid={`button-acknowledge-${alert.id}`}
                                      >
                                        Acknowledge
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-risk-distribution">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        Patient Risk Distribution
                      </CardTitle>
                      <CardDescription>Patients by risk level</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.patientDistribution.map(dist => (
                          <div key={dist.riskLevel} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="capitalize">{dist.riskLevel} Risk</span>
                              <span className="font-medium">{dist.count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${getSeverityColor(dist.riskLevel)}`}
                                style={{ width: `${(dist.count / stats.totalPatients) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{stats.appointmentsToday} appointments today</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{stats.carePlansDue} care plans due</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="patients" className="h-full m-0">
            <div className="flex h-full">
              <div className="w-80 border-r flex flex-col">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-patients"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredPatients.map(p => (
                        <button
                          key={p.patientId}
                          onClick={() => setSelectedPatientId(p.patientId)}
                          className={`w-full text-left p-3 rounded-lg hover-elevate ${
                            selectedPatientId === p.patientId ? "bg-accent" : ""
                          }`}
                          data-testid={`patient-item-${p.patientId}`}
                        >
                          <div className="font-medium">{p.patientName}</div>
                          <div className="text-sm text-muted-foreground">
                            MRN: {p.mrn} | DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Quality: {p.dataQualityScore}%
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex-1 overflow-auto">
                {selectedPatientId ? (
                  patientLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : patient ? (
                    <div className="p-6 space-y-6">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h2 className="text-2xl font-bold" data-testid="text-patient-name">{patient.patientName}</h2>
                          <p className="text-muted-foreground">
                            {patient.demographics.age} years old | {patient.demographics.gender} | MRN: {patient.mrn}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Database className="h-3 w-3" />
                            {patient.dataSources.length} Data Sources
                          </Badge>
                          <Badge className={patient.dataQualityScore >= 90 ? "bg-green-500" : "bg-yellow-500"}>
                            Quality: {patient.dataQualityScore}%
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card data-testid="card-data-sources">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Database className="h-4 w-4" />
                              Connected Data Sources
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {patient.dataSources.map(ds => (
                                <div key={ds.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                  <div>
                                    <div className="font-medium text-sm">{ds.sourceName}</div>
                                    <div className="text-xs text-muted-foreground">{ds.organization}</div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={ds.connectionStatus === "active" ? "default" : "secondary"} className="text-xs">
                                      {ds.connectionStatus}
                                    </Badge>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {ds.recordCount} records
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card data-testid="card-allergies">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              Allergies
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {patient.allergies.map(a => (
                                <div key={a.id} className="flex items-center justify-between">
                                  <span className="font-medium">{a.substance}</span>
                                  <Badge variant={a.severity === "life_threatening" ? "destructive" : "secondary"}>
                                    {a.severity.replace("_", " ")}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card data-testid="card-conditions">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Stethoscope className="h-4 w-4" />
                              Active Conditions
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {patient.conditions.map(c => (
                                <div key={c.id} className="p-2 rounded-lg bg-muted/50">
                                  <div className="font-medium text-sm">{c.display}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {c.sources.join(", ")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card data-testid="card-medications">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Pill className="h-4 w-4" />
                              Medications
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {patient.medications.map(m => (
                                <div key={m.id} className="p-2 rounded-lg bg-muted/50">
                                  <div className="font-medium text-sm">{m.display}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {m.frequency}
                                    {m.adherenceRate && ` | Adherence: ${m.adherenceRate}%`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card data-testid="card-lab-results">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <FlaskConical className="h-4 w-4" />
                              Recent Labs
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {patient.labResults.slice(0, 4).map(l => (
                                <div key={l.id} className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm">{l.testName}</div>
                                    <div className="text-xs text-muted-foreground">{l.value} {l.unit}</div>
                                  </div>
                                  {getInterpretationBadge(l.interpretation)}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card data-testid="card-ai-insights">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            AI-Powered Insights
                            <Badge variant="outline" className="ml-2 text-xs text-yellow-600 border-yellow-500">
                              INFORMATIONAL ONLY
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Aggregated analysis from Interoperability Hub data sources - NOT clinical decision support
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {insightsLoading ? (
                            <div className="flex items-center justify-center h-32">
                              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : insights ? (
                            <div className="space-y-6">
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Clinical Summary</AlertTitle>
                                <AlertDescription>{insights.clinicalSummary}</AlertDescription>
                              </Alert>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Trends
                                  </h4>
                                  <div className="space-y-2">
                                    {insights.trends.map((t, i) => (
                                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                        {getTrendIcon(t.direction)}
                                        <div>
                                          <div className="font-medium text-sm">{t.metric}</div>
                                          <div className="text-xs text-muted-foreground">{t.description}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Risk Factors
                                  </h4>
                                  <div className="space-y-2">
                                    {insights.riskFactors.map((r, i) => (
                                      <div key={i} className="p-2 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-2">
                                          <div className={`h-2 w-2 rounded-full ${getSeverityColor(r.level)}`} />
                                          <span className="font-medium text-sm">{r.factor}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  Recommendations
                                </h4>
                                <div className="space-y-2">
                                  {insights.recommendations.map((r, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                                      <Badge className={getSeverityColor(r.priority)}>{r.priority}</Badge>
                                      <div>
                                        <div className="font-medium">{r.title}</div>
                                        <div className="text-sm text-muted-foreground">{r.description}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
                                <Shield className="h-4 w-4" />
                                <AlertTitle>NO-CDS Compliance Notice</AlertTitle>
                                <AlertDescription className="text-xs">
                                  {insights.disclaimer}
                                </AlertDescription>
                              </Alert>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Users className="h-12 w-12 mb-4" />
                    <p>Select a patient to view aggregated data</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messaging" className="h-full m-0">
            <div className="flex h-full">
              <div className="w-80 border-r flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-medium">Conversations</h3>
                </div>
                <ScrollArea className="flex-1">
                  {conversationsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No conversations yet
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {conversations.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedConversationId(c.id)}
                          className={`w-full text-left p-3 rounded-lg hover-elevate ${
                            selectedConversationId === c.id ? "bg-accent" : ""
                          }`}
                          data-testid={`conversation-item-${c.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{c.patientName || c.subject}</span>
                            {c.unreadCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 p-0 text-xs flex items-center justify-center">
                                {c.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">{c.lastMessage}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(c.lastMessageAt).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex-1 flex flex-col">
                {selectedConversationId ? (
                  <>
                    <div className="p-4 border-b">
                      {conversations.find(c => c.id === selectedConversationId) && (
                        <div>
                          <h3 className="font-medium">
                            {conversations.find(c => c.id === selectedConversationId)?.patientName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {conversations.find(c => c.id === selectedConversationId)?.subject}
                          </p>
                        </div>
                      )}
                    </div>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.map(m => (
                          <div
                            key={m.id}
                            className={`flex ${m.senderRole === "provider" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-lg ${
                                m.senderRole === "provider"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                              data-testid={`message-item-${m.id}`}
                            >
                              <div className="text-xs opacity-70 mb-1">
                                {m.senderName} - {new Date(m.createdAt).toLocaleString()}
                              </div>
                              <p className="text-sm">{m.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="resize-none"
                          rows={2}
                          data-testid="input-new-message"
                        />
                        <Button
                          onClick={() => {
                            const conv = conversations.find(c => c.id === selectedConversationId);
                            if (conv && newMessage.trim()) {
                              sendMessageMutation.mutate({
                                conversationId: selectedConversationId,
                                content: newMessage,
                                recipientId: conv.patientId || "unknown",
                              });
                            }
                          }}
                          disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4" />
                    <p>Select a conversation to view messages</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visualizations" className="h-full m-0 p-6">
            <CustomizableDashboard
              widgets={dashboardWidgets}
              onWidgetsChange={setDashboardWidgets}
              vitalsData={vitalsData}
              labsData={labsData}
              adherenceData={adherenceData}
              locationData={locationData}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default DedicatedProviderPortal;
