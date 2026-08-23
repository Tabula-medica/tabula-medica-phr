import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clickable } from "@/lib/a11y";
import {
  User,
  Database,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Heart,
  Pill,
  Stethoscope,
  Syringe,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Lock,
  Users,
  Calendar
} from "lucide-react";

interface PatientSummary {
  patientId: string;
  name: string;
  sourceCount: number;
  qualityScore: number;
}

interface DataSource {
  id: string;
  sourceSystem: string;
  sourceType: string;
  lastSyncTime: string;
  recordCount: number;
  dataQualityScore: number;
  syncStatus: "active" | "stale" | "error" | "pending";
}

interface PatientResource {
  resourceType: string;
  id: string;
  source: string;
  lastUpdated: string;
  qualityScore: number;
  hasConflicts: boolean;
  conflictDetails?: string[];
}

interface DataQualityMetrics {
  overallScore: number;
  completenessScore: number;
  consistencyScore: number;
  timelinessScore: number;
  accuracyScore: number;
  duplicateCount: number;
  conflictCount: number;
  missingFieldsCount: number;
  qualityTrend: "improving" | "stable" | "declining";
  lastAssessment: string;
}

interface SecurityPosture {
  accessLogCount: number;
  lastAccessTime: string;
  authorizedUsers: number;
  pendingConsentRequests: number;
  dataBreachRisk: "low" | "medium" | "high";
  encryptionStatus: string;
  auditCompliance: number;
  lastSecurityReview: string;
  accessPatternAnomaly: boolean;
}

interface ClinicalSummary {
  resourceCounts: Record<string, number>;
  dateRange: { earliest: string; latest: string };
  primaryConditions: string[];
  activeMedications: number;
  recentEncounters: number;
  labResultsCount: number;
  imagingStudiesCount: number;
  allergyCount: number;
  immunizationCount: number;
}

interface AIInsight {
  id: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendation: string;
  affectedResources: string[];
  generatedAt: string;
}

interface Patient360View {
  patientId: string;
  patientIdentifiers: { system: string; value: string }[];
  demographics: {
    name: string;
    birthDate: string;
    gender: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  dataSources: DataSource[];
  resources: PatientResource[];
  dataQuality: DataQualityMetrics;
  security: SecurityPosture;
  clinicalSummary: ClinicalSummary;
  aiInsights: AIInsight[];
  lastUpdated: string;
  noCdsCompliance: string;
}

export default function Patient360() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: statsData } = useQuery<{ totalPatients: number; averageQualityScore: number; totalDataSources: number; totalConflicts: number; patientsWithIssues: number }>({
    queryKey: ["/api/patient-360/stats"]
  });

  const { data: patientsData } = useQuery<{ patients: PatientSummary[] }>({
    queryKey: ["/api/patient-360/patients"]
  });

  const { data: patientViewData, isLoading: isLoadingView, refetch: refetchView } = useQuery<{ view: Patient360View }>({
    queryKey: [`/api/patient-360/view/${selectedPatientId}`],
    enabled: !!selectedPatientId
  });

  const patientView = patientViewData?.view;
  const patients = patientsData?.patients || [];
  const stats = statsData;

  const getQualityColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 75) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "stale":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Stale</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case "Condition":
        return <Heart className="h-4 w-4" />;
      case "MedicationRequest":
        return <Pill className="h-4 w-4" />;
      case "Observation":
        return <Activity className="h-4 w-4" />;
      case "Encounter":
        return <Stethoscope className="h-4 w-4" />;
      case "Immunization":
        return <Syringe className="h-4 w-4" />;
      case "AllergyIntolerance":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Patient 360 View</h1>
          <p className="text-muted-foreground">
            Unified patient data integration from all sources
          </p>
        </div>
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Data integration view only. No clinical decision support.
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-patients">{stats?.totalPatients || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getQualityColor(stats?.averageQualityScore || 0)}`} data-testid="text-avg-quality">
              {(stats?.averageQualityScore || 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-data-sources">{stats?.totalDataSources || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Data Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-conflicts">{stats?.totalConflicts || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Patients</CardTitle>
            <CardDescription>Select a patient to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {patients.map((patient) => (
                  <div
                    key={patient.patientId}
                    className={`p-3 rounded-lg cursor-pointer transition-colors hover-elevate ${
                      selectedPatientId === patient.patientId
                        ? "bg-primary/10 border border-primary"
                        : "bg-muted/50"
                    }`}
                    {...clickable(() => setSelectedPatientId(patient.patientId))}
                    data-testid={`card-patient-${patient.patientId}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{patient.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Database className="h-3 w-3" />
                      <span>{patient.sourceCount} sources</span>
                      <span className={getQualityColor(patient.qualityScore)}>
                        {patient.qualityScore.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          {!selectedPatientId ? (
            <CardContent className="flex items-center justify-center h-[550px]">
              <div className="text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a patient to view their 360-degree data integration</p>
              </div>
            </CardContent>
          ) : isLoadingView ? (
            <CardContent className="flex items-center justify-center h-[550px]">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          ) : patientView ? (
            <>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {patientView.demographics.name}
                  </CardTitle>
                  <CardDescription>
                    {patientView.demographics.gender} | DOB: {patientView.demographics.birthDate}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchView()} data-testid="button-refresh">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="sources" data-testid="tab-sources">Sources</TabsTrigger>
                    <TabsTrigger value="quality" data-testid="tab-quality">Quality</TabsTrigger>
                    <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
                    <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground">Conditions</div>
                        <div className="text-2xl font-bold">{patientView.clinicalSummary.resourceCounts.Condition || 0}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground">Active Medications</div>
                        <div className="text-2xl font-bold">{patientView.clinicalSummary.activeMedications}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground">Lab Results</div>
                        <div className="text-2xl font-bold">{patientView.clinicalSummary.labResultsCount}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="text-sm text-muted-foreground">Recent Encounters</div>
                        <div className="text-2xl font-bold">{patientView.clinicalSummary.recentEncounters}</div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">Primary Conditions</h4>
                      <div className="flex flex-wrap gap-2">
                        {patientView.clinicalSummary.primaryConditions.map((condition, i) => (
                          <Badge key={i} variant="secondary">
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Data Quality</h4>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.dataQuality.overallScore} className="flex-1" />
                          <span className={getQualityColor(patientView.dataQuality.overallScore)}>
                            {patientView.dataQuality.overallScore.toFixed(1)}%
                          </span>
                          {getTrendIcon(patientView.dataQuality.qualityTrend)}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Security Compliance</h4>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.security.auditCompliance} className="flex-1" />
                          <span className={getQualityColor(patientView.security.auditCompliance)}>
                            {patientView.security.auditCompliance.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="sources" className="space-y-4 mt-4">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {patientView.dataSources.map((source) => (
                          <div key={source.id} className="p-4 rounded-lg border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Database className="h-5 w-5 text-primary" />
                                <div>
                                  <div className="font-medium">{source.sourceSystem}</div>
                                  <div className="text-sm text-muted-foreground capitalize">{source.sourceType}</div>
                                </div>
                              </div>
                              {getSyncStatusBadge(source.syncStatus)}
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div>
                                <div className="text-muted-foreground">Records</div>
                                <div className="font-medium">{source.recordCount.toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Quality</div>
                                <div className={`font-medium ${getQualityColor(source.dataQualityScore)}`}>
                                  {source.dataQualityScore.toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Last Sync</div>
                                <div className="font-medium">
                                  {new Date(source.lastSyncTime).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="quality" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">Completeness</div>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.dataQuality.completenessScore} className="flex-1" />
                          <span className="font-medium">{patientView.dataQuality.completenessScore.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">Consistency</div>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.dataQuality.consistencyScore} className="flex-1" />
                          <span className="font-medium">{patientView.dataQuality.consistencyScore.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">Timeliness</div>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.dataQuality.timelinessScore} className="flex-1" />
                          <span className="font-medium">{patientView.dataQuality.timelinessScore.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">Accuracy</div>
                        <div className="flex items-center gap-2">
                          <Progress value={patientView.dataQuality.accuracyScore} className="flex-1" />
                          <span className="font-medium">{patientView.dataQuality.accuracyScore.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Duplicates</div>
                          <div className="text-2xl font-bold">{patientView.dataQuality.duplicateCount}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Conflicts</div>
                          <div className="text-2xl font-bold text-yellow-600">{patientView.dataQuality.conflictCount}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Missing Fields</div>
                          <div className="text-2xl font-bold">{patientView.dataQuality.missingFieldsCount}</div>
                        </CardContent>
                      </Card>
                    </div>

                    {patientView.resources.filter(r => r.hasConflicts).length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Resources with Conflicts</h4>
                        <div className="space-y-2">
                          {patientView.resources.filter(r => r.hasConflicts).map((resource) => (
                            <div key={resource.id} className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                              <div className="flex items-center gap-2">
                                {getResourceIcon(resource.resourceType)}
                                <span className="font-medium">{resource.resourceType}</span>
                                <Badge variant="outline">{resource.source}</Badge>
                              </div>
                              {resource.conflictDetails?.map((detail, i) => (
                                <div key={i} className="text-sm text-muted-foreground mt-1 ml-6">
                                  {detail}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="security" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          Access Logs
                        </div>
                        <div className="text-2xl font-bold mt-1">{patientView.security.accessLogCount}</div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          Authorized Users
                        </div>
                        <div className="text-2xl font-bold mt-1">{patientView.security.authorizedUsers}</div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          Encryption
                        </div>
                        <div className="text-lg font-bold mt-1 capitalize">{patientView.security.encryptionStatus}</div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          Breach Risk
                        </div>
                        <Badge
                          className={`mt-1 ${
                            patientView.security.dataBreachRisk === "low"
                              ? "bg-green-500"
                              : patientView.security.dataBreachRisk === "medium"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        >
                          {patientView.security.dataBreachRisk.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Last Access
                          </div>
                          <div className="font-medium mt-1">
                            {new Date(patientView.security.lastAccessTime).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            Last Security Review
                          </div>
                          <div className="font-medium mt-1">
                            {new Date(patientView.security.lastSecurityReview).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {patientView.security.accessPatternAnomaly && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Pattern Anomaly Detected</AlertTitle>
                        <AlertDescription>
                          Unusual access patterns have been detected for this patient's records. Review access logs immediately.
                        </AlertDescription>
                      </Alert>
                    )}

                    {patientView.security.pendingConsentRequests > 0 && (
                      <Alert>
                        <FileText className="h-4 w-4" />
                        <AlertTitle>Pending Consent Requests</AlertTitle>
                        <AlertDescription>
                          {patientView.security.pendingConsentRequests} consent request(s) awaiting patient response.
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>

                  <TabsContent value="insights" className="space-y-4 mt-4">
                    <Alert className="mb-4">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {patientView.noCdsCompliance}
                      </AlertDescription>
                    </Alert>
                    <ScrollArea className="h-[320px]">
                      <div className="space-y-3">
                        {patientView.aiInsights.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No AI insights generated. Data appears to be in good condition.</p>
                          </div>
                        ) : (
                          patientView.aiInsights.map((insight) => (
                            <Alert
                              key={insight.id}
                              variant={insight.severity === "critical" ? "destructive" : "default"}
                            >
                              <div className="flex items-start gap-2">
                                {getSeverityIcon(insight.severity)}
                                <div className="flex-1">
                                  <AlertTitle className="flex items-center gap-2">
                                    {insight.title}
                                    <Badge variant="outline" className="text-xs">
                                      {insight.category}
                                    </Badge>
                                  </AlertTitle>
                                  <AlertDescription className="mt-1">
                                    {insight.description}
                                  </AlertDescription>
                                  {insight.recommendation && (
                                    <div className="mt-2 text-sm">
                                      <span className="font-medium">Recommendation: </span>
                                      {insight.recommendation}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Alert>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
