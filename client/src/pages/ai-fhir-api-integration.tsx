import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Globe, 
  Search, 
  Code, 
  Lightbulb, 
  RefreshCw, 
  Plus, 
  Server, 
  FileJson, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Download,
  Play,
  Sparkles,
  Database,
  GitMerge,
  Shield,
  Settings,
  Zap,
  BarChart3,
  Link as LinkIcon
} from "lucide-react";

interface FHIRServerCapability {
  resourceType: string;
  interactions: string[];
  searchParams: string[];
  versioning: boolean;
  readHistory: boolean;
}

interface FHIRServerDiscovery {
  id: string;
  baseUrl: string;
  serverName: string;
  fhirVersion: string;
  publisher?: string;
  status: 'active' | 'discovering' | 'error' | 'unreachable';
  discoveredAt: string;
  lastUpdated: string;
  security?: {
    cors: boolean;
    service?: string[];
    tokenEndpoint?: string;
    authorizeEndpoint?: string;
  };
  capabilities: FHIRServerCapability[];
  supportedFormats: string[];
  totalResources: number;
  errorMessage?: string;
}

interface MappingConfiguration {
  id: string;
  name: string;
  description: string;
  sourceServerId: string;
  targetServerId: string;
  resourceType: string;
  mappings: FieldMapping[];
  transformations: Transformation[];
  validationRules: ValidationRule[];
  status: 'draft' | 'active' | 'testing';
  createdAt: string;
  updatedAt: string;
}

interface FieldMapping {
  id: string;
  sourcePath: string;
  targetPath: string;
  transform?: string;
  defaultValue?: string;
  required: boolean;
  description?: string;
}

interface Transformation {
  id: string;
  name: string;
  type: string;
  sourcePath: string;
  targetPath: string;
  config: Record<string, unknown>;
  description: string;
}

interface ValidationRule {
  id: string;
  name: string;
  type: string;
  path: string;
  config: Record<string, unknown>;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface TransformationSuggestion {
  id: string;
  type: 'mapping' | 'transformation' | 'validation';
  confidence: number;
  title: string;
  description: string;
  suggestion: unknown;
  rationale: string;
  noCdsCompliance: string;
}

interface GeneratedCode {
  language: string;
  code: string;
  dependencies: string[];
  instructions: string;
  noCdsCompliance: string;
}

interface ValidationRuleResult {
  resourceType: string;
  strictness: string;
  rules: ValidationRule[];
  totalRules: number;
  noCdsCompliance: string;
}

interface TransformationRuleResult {
  resourceType: string;
  targetFormat: string;
  rules: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    sourcePath: string;
    targetPath: string;
    config: Record<string, unknown>;
  }>;
  totalRules: number;
  noCdsCompliance: string;
}

interface CompatibilityResult {
  server1: { id: string; name: string };
  server2: { id: string; name: string };
  overallCompatibility: number;
  commonResources: string[];
  differences: Array<{ resource: string; server1Support: string[]; server2Support: string[] }>;
  recommendations: string[];
  noCdsCompliance: string;
}

interface SmartConfiguration {
  serverId: string;
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  capabilities: string[];
  noCdsCompliance: string;
}

interface IntegrationHealthStatus {
  id: string;
  integrationId: string;
  integrationName: string;
  integrationType: 'discovery' | 'mapping' | 'connector';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: string;
  lastSuccessful: string | null;
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  consecutiveFailures: number;
  alerts: IntegrationAlert[];
}

interface IntegrationAlert {
  id: string;
  integrationId: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'connectivity' | 'performance' | 'validation' | 'security' | 'data_quality';
  title: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  acknowledged: boolean;
}

interface IntegrationMetrics {
  id: string;
  integrationId: string;
  timestamp: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  dataVolume: number;
  recordsProcessed: number;
}

interface HealthDashboardSummary {
  totalIntegrations: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  overallHealthScore: number;
  activeAlerts: IntegrationAlert[];
  recentMetrics: IntegrationMetrics[];
  topPerformers: IntegrationHealthStatus[];
  needsAttention: IntegrationHealthStatus[];
  noCdsCompliance: string;
}

interface PerformanceAnalytics {
  summary: {
    avgResponseTime: number;
    avgErrorRate: number;
    avgThroughput: number;
    totalRequests: number;
    successRate: number;
  };
  trends: {
    responseTimeTrend: 'improving' | 'stable' | 'degrading';
    errorRateTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'increasing' | 'stable' | 'decreasing';
  };
  recommendations: string[];
  noCdsCompliance: string;
}

interface IntelligentConnector {
  id: string;
  name: string;
  description: string;
  connectorType: 'fhir_r4' | 'fhir_r5' | 'hl7v2' | 'cda' | 'custom';
  sourceServerId?: string;
  targetSystem: string;
  status: 'draft' | 'configured' | 'testing' | 'active' | 'disabled';
  autoGenerated: boolean;
  fieldMappings: CrossSystemFieldMapping[];
  authConfig: { authType: string; tokenEndpoint?: string; scopes?: string[] };
  syncConfig: { syncMode: string; batchSize?: number; syncInterval?: number };
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  syncStats: { totalSynced: number; failedRecords: number; lastDuration: number };
}

interface CrossSystemFieldMapping {
  id: string;
  sourceSystem: string;
  sourceResourceType: string;
  sourceField: string;
  sourceFieldType: string;
  targetSystem: string;
  targetResourceType: string;
  targetField: string;
  targetFieldType: string;
  transformationType: 'direct' | 'code_mapping' | 'format_conversion' | 'calculation' | 'conditional' | 'custom';
  confidence: number;
  aiGenerated: boolean;
  validationStatus: 'pending' | 'validated' | 'rejected';
  notes?: string;
}

interface ConnectorDashboard {
  totalConnectors: number;
  activeConnectors: number;
  configuredConnectors: number;
  draftConnectors: number;
  totalFieldMappings: number;
  aiGeneratedMappings: number;
  averageDataQuality: number;
  recentSyncs: { connectorId: string; connectorName: string; syncedAt: string; recordCount: number; status: string }[];
  schemaInsights: string[];
  noCdsCompliance: string;
}

export default function AIFHIRAPIIntegration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("discoveries");
  const [discoverUrl, setDiscoverUrl] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<FHIRServerDiscovery | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<MappingConfiguration | null>(null);
  const [codeLanguage, setCodeLanguage] = useState<'typescript' | 'javascript' | 'python' | 'json'>('typescript');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [suggestions, setSuggestions] = useState<TransformationSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionResourceType, setSuggestionResourceType] = useState("");

  const [validationResourceType, setValidationResourceType] = useState("");
  const [validationStrictness, setValidationStrictness] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationRuleResult | null>(null);
  const [transformResourceType, setTransformResourceType] = useState("");
  const [transformTargetFormat, setTransformTargetFormat] = useState("");
  const [transformResult, setTransformResult] = useState<TransformationRuleResult | null>(null);
  const [compatServer1, setCompatServer1] = useState("");
  const [compatServer2, setCompatServer2] = useState("");
  const [compatResult, setCompatResult] = useState<CompatibilityResult | null>(null);
  const [smartConfigs, setSmartConfigs] = useState<Record<string, SmartConfiguration>>({});

  const { data: metadata } = useQuery<{ serviceName: string; version: string; description: string; capabilities: string[]; noCdsCompliance: string }>({
    queryKey: ['/api/fhir-api-integration/metadata']
  });

  const { data: discoveries = [], isLoading: discoveriesLoading } = useQuery<FHIRServerDiscovery[]>({
    queryKey: ['/api/fhir-api-integration/discoveries']
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery<MappingConfiguration[]>({
    queryKey: ['/api/fhir-api-integration/mappings']
  });

  const { data: healthDashboard, isLoading: healthLoading } = useQuery<HealthDashboardSummary>({
    queryKey: ['/api/fhir-api-integration/health/dashboard']
  });

  const { data: performanceAnalytics } = useQuery<PerformanceAnalytics>({
    queryKey: ['/api/fhir-api-integration/analytics/performance']
  });

  const { data: connectorDashboard } = useQuery<ConnectorDashboard>({
    queryKey: ['/api/fhir-api-integration/connectors/dashboard']
  });

  const { data: connectorsData } = useQuery<{ items: IntelligentConnector[] }>({
    queryKey: ['/api/fhir-api-integration/connectors']
  });
  const connectorsList = connectorsData?.items || [];

  const { data: crossMappingsData } = useQuery<{ items: CrossSystemFieldMapping[] }>({
    queryKey: ['/api/fhir-api-integration/cross-system-mappings']
  });
  const crossMappingsList = crossMappingsData?.items || [];

  const runHealthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/fhir-api-integration/health/check-all', {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/health/dashboard'] });
      toast({ title: "Health Check Complete", description: "All integrations have been checked" });
    },
    onError: () => {
      toast({ title: "Health Check Failed", description: "Could not complete health checks", variant: "destructive" });
    }
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest('POST', `/api/fhir-api-integration/alerts/${alertId}/acknowledge`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/health/dashboard'] });
      toast({ title: "Alert Acknowledged" });
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest('POST', `/api/fhir-api-integration/alerts/${alertId}/resolve`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/health/dashboard'] });
      toast({ title: "Alert Resolved" });
    }
  });

  const discoverMutation = useMutation({
    mutationFn: async (baseUrl: string) => {
      setIsDiscovering(true);
      const response = await apiRequest('POST', '/api/fhir-api-integration/discover', { baseUrl });
      return await response.json() as FHIRServerDiscovery;
    },
    onSuccess: (discovery: FHIRServerDiscovery) => {
      setIsDiscovering(false);
      queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/discoveries'] });
      if (discovery.status === 'active') {
        toast({ title: "Server Discovered", description: `Found ${discovery.totalResources} resources on ${discovery.serverName}` });
      } else {
        toast({ title: "Discovery Issue", description: discovery.errorMessage || "Could not fully discover server", variant: "destructive" });
      }
      setDiscoverUrl("");
    },
    onError: () => {
      setIsDiscovering(false);
      toast({ title: "Discovery Failed", description: "Could not connect to FHIR server", variant: "destructive" });
    }
  });

  const generateCodeMutation = useMutation({
    mutationFn: async ({ mappingId, language }: { mappingId: string; language: string }) => {
      const response = await apiRequest('POST', `/api/fhir-api-integration/mappings/${mappingId}/generate-code`, { language });
      return await response.json() as GeneratedCode;
    },
    onSuccess: (code: GeneratedCode) => {
      setGeneratedCode(code);
      toast({ title: "Code Generated", description: `${code.language} integration code ready` });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate code", variant: "destructive" });
    }
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async ({ sourceServerId, resourceType }: { sourceServerId: string; resourceType: string }) => {
      setIsGeneratingSuggestions(true);
      const response = await apiRequest('POST', '/api/fhir-api-integration/suggestions', { sourceServerId, targetServerId: 'local', resourceType });
      return await response.json() as { suggestions: TransformationSuggestion[] };
    },
    onSuccess: (data: { suggestions: TransformationSuggestion[] }) => {
      setIsGeneratingSuggestions(false);
      setSuggestions(data.suggestions);
      toast({ title: "Suggestions Generated", description: `Found ${data.suggestions.length} AI suggestions` });
    },
    onError: () => {
      setIsGeneratingSuggestions(false);
      toast({ title: "Generation Failed", description: "Could not generate suggestions", variant: "destructive" });
    }
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/discoveries'] });
    queryClient.invalidateQueries({ queryKey: ['/api/fhir-api-integration/mappings'] });
    toast({ title: "Refreshed", description: "Data reloaded" });
  };

  const generateValidationRulesMutation = useMutation({
    mutationFn: async ({ resourceType, strictness }: { resourceType: string; strictness: string }) => {
      const response = await apiRequest('POST', '/api/fhir-api-integration/validation-rules', { resourceType, strictness });
      return await response.json() as ValidationRuleResult;
    },
    onSuccess: (data: ValidationRuleResult) => {
      setValidationResult(data);
      toast({ title: "Validation Rules Generated", description: `Generated ${data.totalRules} rules for ${data.resourceType}` });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate validation rules", variant: "destructive" });
    }
  });

  const generateTransformationRulesMutation = useMutation({
    mutationFn: async ({ resourceType, targetFormat }: { resourceType: string; targetFormat: string }) => {
      const response = await apiRequest('POST', '/api/fhir-api-integration/transformation-rules', { resourceType, targetFormat });
      return await response.json() as TransformationRuleResult;
    },
    onSuccess: (data: TransformationRuleResult) => {
      setTransformResult(data);
      toast({ title: "Transformation Rules Generated", description: `Generated ${data.totalRules} rules for ${data.resourceType} to ${data.targetFormat}` });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate transformation rules", variant: "destructive" });
    }
  });

  const analyzeCompatibilityMutation = useMutation({
    mutationFn: async ({ server1Id, server2Id }: { server1Id: string; server2Id: string }) => {
      const response = await apiRequest('POST', '/api/fhir-api-integration/compatibility', { serverId1: server1Id, serverId2: server2Id });
      return await response.json() as CompatibilityResult;
    },
    onSuccess: (data: CompatibilityResult) => {
      setCompatResult(data);
      toast({ title: "Compatibility Analyzed", description: `${data.commonResources.length} common resources found (${data.overallCompatibility}% compatible)` });
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not analyze server compatibility", variant: "destructive" });
    }
  });

  const discoverSmartConfigMutation = useMutation({
    mutationFn: async (serverId: string) => {
      const response = await apiRequest('POST', '/api/fhir-api-integration/smart-configuration', { serverId });
      return await response.json() as SmartConfiguration;
    },
    onSuccess: (data: SmartConfiguration) => {
      setSmartConfigs(prev => ({ ...prev, [data.serverId]: data }));
      toast({ title: "SMART Config Discovered", description: `Found ${data.capabilities.length} SMART capabilities` });
    },
    onError: () => {
      toast({ title: "Discovery Failed", description: "Could not discover SMART configuration", variant: "destructive" });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-foreground" />;
      case 'discovering': return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      discovering: "secondary",
      error: "destructive",
      draft: "outline",
      testing: "secondary"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">AI FHIR API Integration</h1>
            <p className="text-muted-foreground">
              Automatically discover FHIR endpoints, generate integration code, and get AI-powered transformation suggestions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">NO-CDS Compliance Notice</p>
              <p className="text-sm text-muted-foreground">
                {metadata?.noCdsCompliance || "This AI-driven FHIR API integration tool is for DATA GOVERNANCE, INTEROPERABILITY, and OPERATIONAL purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice."}
              </p>
            </div>
          </div>
        </div>

        {metadata && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-server-count">{discoveries.length}</p>
                    <p className="text-sm text-muted-foreground">Discovered Servers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-mapping-count">{mappings.length}</p>
                    <p className="text-sm text-muted-foreground">Mapping Configurations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-resource-count">{discoveries.reduce((sum, d) => sum + d.totalResources, 0)}</p>
                    <p className="text-sm text-muted-foreground">Total Resources</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{discoveries.filter(d => d.security?.cors).length}</p>
                    <p className="text-sm text-muted-foreground">CORS Enabled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7 gap-1">
            <TabsTrigger value="discoveries" data-testid="tab-discoveries">
              <Globe className="h-4 w-4 mr-2" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="connectors" data-testid="tab-connectors">
              <LinkIcon className="h-4 w-4 mr-2" />
              Connectors
            </TabsTrigger>
            <TabsTrigger value="mappings" data-testid="tab-mappings">
              <GitMerge className="h-4 w-4 mr-2" />
              Mappings
            </TabsTrigger>
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              <Lightbulb className="h-4 w-4 mr-2" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="code" data-testid="tab-code">
              <Code className="h-4 w-4 mr-2" />
              Code Gen
            </TabsTrigger>
            <TabsTrigger value="health" data-testid="tab-health">
              <BarChart3 className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced">
              <Settings className="h-4 w-4 mr-2" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discoveries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Discover FHIR Server
                </CardTitle>
                <CardDescription>
                  Enter a FHIR server base URL to automatically discover its capabilities, resources, and security configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://hapi.fhir.org/baseR4"
                    value={discoverUrl}
                    onChange={(e) => setDiscoverUrl(e.target.value)}
                    className="flex-1"
                    data-testid="input-discover-url"
                  />
                  <Button 
                    onClick={() => discoverMutation.mutate(discoverUrl)} 
                    disabled={!discoverUrl || isDiscovering}
                    data-testid="button-discover"
                  >
                    {isDiscovering ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Discover
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {discoveriesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : discoveries.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No servers discovered yet. Enter a FHIR server URL above to get started.
                  </CardContent>
                </Card>
              ) : (
                discoveries.map((discovery) => (
                  <Card key={discovery.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedDiscovery(discovery)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(discovery.status)}
                          <div>
                            <CardTitle className="text-lg">{discovery.serverName}</CardTitle>
                            <CardDescription className="font-mono text-xs">{discovery.baseUrl}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">FHIR {discovery.fhirVersion}</Badge>
                          {getStatusBadge(discovery.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Resources</p>
                          <p className="font-medium">{discovery.totalResources}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Publisher</p>
                          <p className="font-medium">{discovery.publisher || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Formats</p>
                          <p className="font-medium">{discovery.supportedFormats.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CORS</p>
                          <p className="font-medium">{discovery.security?.cors ? 'Enabled' : 'Disabled'}</p>
                        </div>
                      </div>
                      {discovery.capabilities.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1">
                          {discovery.capabilities.slice(0, 8).map((cap) => (
                            <Badge key={cap.resourceType} variant="secondary" className="text-xs">
                              {cap.resourceType}
                            </Badge>
                          ))}
                          {discovery.capabilities.length > 8 && (
                            <Badge variant="outline" className="text-xs">+{discovery.capabilities.length - 8} more</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="connectors" className="space-y-4">
            {connectorDashboard && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-total-connectors">{connectorDashboard.totalConnectors}</p>
                        <p className="text-sm text-muted-foreground">Total Connectors</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-active-connectors">{connectorDashboard.activeConnectors}</p>
                        <p className="text-sm text-muted-foreground">Active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <GitMerge className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-total-mappings">{connectorDashboard.totalFieldMappings}</p>
                        <p className="text-sm text-muted-foreground">Field Mappings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold" data-testid="text-ai-mappings">{connectorDashboard.aiGeneratedMappings}</p>
                        <p className="text-sm text-muted-foreground">AI Generated</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Intelligent Connectors
                </CardTitle>
                <CardDescription>
                  AI-powered connectors with auto-configuration, schema analysis, and cross-system field mapping
                </CardDescription>
              </CardHeader>
              <CardContent>
                {connectorsList.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No connectors configured. Discover a FHIR server first to create an intelligent connector.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {connectorsList.map((connector) => (
                      <Card key={connector.id} data-testid={`card-connector-${connector.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">{connector.name}</CardTitle>
                              <Badge variant={
                                connector.status === 'active' ? 'default' :
                                connector.status === 'configured' ? 'secondary' :
                                connector.status === 'testing' ? 'outline' :
                                'destructive'
                              } data-testid={`badge-connector-status-${connector.id}`}>
                                {connector.status}
                              </Badge>
                              {connector.autoGenerated && (
                                <Badge variant="outline">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Auto-generated
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline">{connector.connectorType?.toUpperCase() || 'UNKNOWN'}</Badge>
                          </div>
                          <CardDescription>{connector.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <p className="text-sm font-medium">Authentication</p>
                              <p className="text-sm text-muted-foreground">{connector.authConfig?.authType?.replace('_', ' ') || 'Not configured'}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Sync Mode</p>
                              <p className="text-sm text-muted-foreground">{connector.syncConfig?.syncMode?.replace('_', ' ') || 'Not configured'}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Target System</p>
                              <p className="text-sm text-muted-foreground">{connector.targetSystem || 'Not specified'}</p>
                            </div>
                          </div>
                          
                          {connector.syncStats && connector.syncStats.totalSynced > 0 && (
                            <div className="mt-4 p-3 rounded-md bg-muted/50">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Records Synced</p>
                                    <p className="font-semibold">{connector.syncStats.totalSynced.toLocaleString()}</p>
                                  </div>
                                  {connector.syncStats.failedRecords > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Failed</p>
                                      <p className="font-semibold text-destructive">{connector.syncStats.failedRecords}</p>
                                    </div>
                                  )}
                                  {connector.syncStats.lastDuration && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">Last Duration</p>
                                      <p className="font-semibold">{(connector.syncStats.lastDuration / 1000).toFixed(1)}s</p>
                                    </div>
                                  )}
                                </div>
                                {connector.lastSyncAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Last sync: {new Date(connector.lastSyncAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {connector.fieldMappings && connector.fieldMappings.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-2">Field Mappings ({connector.fieldMappings.length})</p>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {connector.fieldMappings.slice(0, 5).map((mapping) => (
                                  <div 
                                    key={mapping.id} 
                                    className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                                    data-testid={`mapping-row-${mapping.id}`}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{mapping.sourceField}</code>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{mapping.targetField}</code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={
                                        mapping.validationStatus === 'validated' ? 'default' :
                                        mapping.validationStatus === 'rejected' ? 'destructive' :
                                        'outline'
                                      }>
                                        {mapping.validationStatus}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">{Math.round(mapping.confidence * 100)}%</span>
                                    </div>
                                  </div>
                                ))}
                                {connector.fieldMappings.length > 5 && (
                                  <p className="text-xs text-muted-foreground text-center py-1">
                                    +{connector.fieldMappings.length - 5} more mappings
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {connectorDashboard?.schemaInsights && connectorDashboard.schemaInsights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Schema Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {connectorDashboard.schemaInsights.map((insight, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                        <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{insight}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {connectorDashboard?.noCdsCompliance || 'Intelligent connectors are for DATA INTEROPERABILITY purposes ONLY. Not for clinical decision support.'}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Mapping Configurations</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-mapping">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Mapping
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Mapping</DialogTitle>
                    <DialogDescription>
                      Configure how data from external FHIR servers maps to your local system
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-fhir-api-integration-mapping-name">Mapping Name</Label>
                      <Input id="ai-fhir-api-integration-mapping-name" placeholder="Patient Sync - Provider to Local" data-testid="input-mapping-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-fhir-api-integration-source-server">Source Server</Label>
                      <Select>
                        <SelectTrigger id="ai-fhir-api-integration-source-server" data-testid="select-source-server">
                          <SelectValue placeholder="Select source server" />
                        </SelectTrigger>
                        <SelectContent>
                          {discoveries.filter(d => d.status === 'active').map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.serverName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-fhir-api-integration-resource-type">Resource Type</Label>
                      <Select>
                        <SelectTrigger id="ai-fhir-api-integration-resource-type" data-testid="select-resource-type">
                          <SelectValue placeholder="Select resource type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Patient">Patient</SelectItem>
                          <SelectItem value="Observation">Observation</SelectItem>
                          <SelectItem value="Condition">Condition</SelectItem>
                          <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                          <SelectItem value="Encounter">Encounter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" data-testid="button-save-mapping">Create Mapping</Button>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {mappingsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : mappings.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No mappings configured yet. Create a mapping to define how FHIR data transforms.
                  </CardContent>
                </Card>
              ) : (
                mappings.map((mapping) => (
                  <Card key={mapping.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedMapping(mapping)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{mapping.name}</CardTitle>
                          <CardDescription>{mapping.description}</CardDescription>
                        </div>
                        {getStatusBadge(mapping.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span>{mapping.sourceServerId}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span>{mapping.targetServerId}</span>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Resource Type</p>
                          <Badge variant="outline">{mapping.resourceType}</Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Field Mappings</p>
                          <p className="font-medium">{mapping.mappings.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Transformations</p>
                          <p className="font-medium">{mapping.transformations.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI-Powered Mapping Suggestions
                </CardTitle>
                <CardDescription>
                  Get intelligent suggestions for field mappings, transformations, and validation rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-source-server-2">Source Server</Label>
                    <Select onValueChange={(v) => setSelectedDiscovery(discoveries.find(d => d.id === v) || null)}>
                      <SelectTrigger id="ai-fhir-api-integration-source-server-2" data-testid="select-suggestion-server">
                        <SelectValue placeholder="Select server" />
                      </SelectTrigger>
                      <SelectContent>
                        {discoveries.filter(d => d.status === 'active').map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.serverName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-resource-type-2">Resource Type</Label>
                    <Select value={suggestionResourceType} onValueChange={setSuggestionResourceType}>
                      <SelectTrigger id="ai-fhir-api-integration-resource-type-2" data-testid="select-suggestion-resource">
                        <SelectValue placeholder="Select resource" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDiscovery?.capabilities.map((cap) => (
                          <SelectItem key={cap.resourceType} value={cap.resourceType}>{cap.resourceType}</SelectItem>
                        )) || (
                          <>
                            <SelectItem value="Patient">Patient</SelectItem>
                            <SelectItem value="Observation">Observation</SelectItem>
                            <SelectItem value="Condition">Condition</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => selectedDiscovery && suggestionResourceType && generateSuggestionsMutation.mutate({ 
                        sourceServerId: selectedDiscovery.id, 
                        resourceType: suggestionResourceType 
                      })}
                      disabled={!selectedDiscovery || !suggestionResourceType || isGeneratingSuggestions}
                      className="w-full"
                      data-testid="button-generate-suggestions"
                    >
                      {isGeneratingSuggestions ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Suggestions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {suggestions.length > 0 && (
              <div className="grid gap-4">
                {suggestions.map((suggestion) => (
                  <Card key={suggestion.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'mapping' && <GitMerge className="h-4 w-4" />}
                          {suggestion.type === 'transformation' && <RefreshCw className="h-4 w-4" />}
                          {suggestion.type === 'validation' && <CheckCircle className="h-4 w-4" />}
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{suggestion.type}</Badge>
                          <Badge variant={suggestion.confidence > 0.8 ? "default" : "secondary"}>
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>{suggestion.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-3 rounded-md text-sm">
                        <p className="font-medium text-muted-foreground mb-1">Rationale:</p>
                        <p>{suggestion.rationale}</p>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm">View Details</Button>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Generate Integration Code
                </CardTitle>
                <CardDescription>
                  Generate production-ready code for your FHIR data integration mappings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-mapping-configuration">Mapping Configuration</Label>
                    <Select onValueChange={(v) => setSelectedMapping(mappings.find(m => m.id === v) || null)}>
                      <SelectTrigger id="ai-fhir-api-integration-mapping-configuration" data-testid="select-code-mapping">
                        <SelectValue placeholder="Select mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappings.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-language">Language</Label>
                    <Select value={codeLanguage} onValueChange={(v) => setCodeLanguage(v as typeof codeLanguage)}>
                      <SelectTrigger id="ai-fhir-api-integration-language" data-testid="select-code-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="json">JSON Config</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => selectedMapping && generateCodeMutation.mutate({ 
                        mappingId: selectedMapping.id, 
                        language: codeLanguage 
                      })}
                      disabled={!selectedMapping || generateCodeMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-code"
                    >
                      {generateCodeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Generate Code
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {generatedCode && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      Generated {generatedCode.language.toUpperCase()} Code
                    </CardTitle>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 border border-border rounded-md p-3 mb-4 text-sm">
                    <p className="text-muted-foreground">{generatedCode.noCdsCompliance}</p>
                  </div>
                  
                  {generatedCode.dependencies.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">Dependencies:</p>
                      <div className="flex flex-wrap gap-2">
                        {generatedCode.dependencies.map((dep) => (
                          <Badge key={dep} variant="secondary">{dep}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Setup Instructions:</p>
                    <p className="text-sm text-muted-foreground">{generatedCode.instructions}</p>
                  </div>
                  
                  <Textarea 
                    value={generatedCode.code} 
                    readOnly 
                    className="font-mono text-sm h-96"
                    data-testid="textarea-generated-code"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Integrations</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-total-integrations">
                    {healthDashboard?.totalIntegrations || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Healthy</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-healthy-count">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-foreground" />
                      {healthDashboard?.healthyCount || 0}
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Degraded</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-degraded-count">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      {healthDashboard?.degradedCount || 0}
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overall Health Score</CardDescription>
                  <CardTitle className="text-2xl" data-testid="text-health-score">
                    {healthDashboard?.overallHealthScore || 0}%
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Integration Health Status</h3>
              <Button 
                onClick={() => runHealthCheckMutation.mutate()} 
                disabled={runHealthCheckMutation.isPending}
                data-testid="button-run-health-check"
              >
                {runHealthCheckMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Run Health Check
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {healthDashboard?.topPerformers?.map((status) => (
                        <div key={status.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`health-status-${status.integrationId}`}>
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 text-foreground" />
                            <div>
                              <p className="font-medium">{status.integrationName}</p>
                              <p className="text-sm text-muted-foreground">
                                {status.responseTime}ms response | {status.uptime}% uptime
                              </p>
                            </div>
                          </div>
                          <Badge variant="default">Healthy</Badge>
                        </div>
                      ))}
                      {(!healthDashboard?.topPerformers || healthDashboard.topPerformers.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No healthy integrations</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Needs Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {healthDashboard?.needsAttention?.map((status) => (
                        <div key={status.id} className="flex items-center justify-between p-3 border rounded-md" data-testid={`attention-status-${status.integrationId}`}>
                          <div className="flex items-center gap-3">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <div>
                              <p className="font-medium">{status.integrationName}</p>
                              <p className="text-sm text-muted-foreground">
                                {status.errorRate}% error rate | {status.consecutiveFailures} failures
                              </p>
                            </div>
                          </div>
                          <Badge variant={status.status === 'unhealthy' ? 'destructive' : 'secondary'}>
                            {status.status}
                          </Badge>
                        </div>
                      ))}
                      {(!healthDashboard?.needsAttention || healthDashboard.needsAttention.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">All integrations healthy</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {healthDashboard?.activeAlerts && healthDashboard.activeAlerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Active Alerts ({healthDashboard.activeAlerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {healthDashboard.activeAlerts.map((alert) => (
                      <div 
                        key={alert.id} 
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`alert-${alert.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'outline'}>
                            {alert.severity}
                          </Badge>
                          <div>
                            <p className="font-medium">{alert.title}</p>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!alert.acknowledged && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                              data-testid={`button-acknowledge-${alert.id}`}
                            >
                              Acknowledge
                            </Button>
                          )}
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => resolveAlertMutation.mutate(alert.id)}
                            data-testid={`button-resolve-${alert.id}`}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {performanceAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-2xl font-bold" data-testid="text-avg-response">{performanceAnalytics.summary.avgResponseTime}ms</p>
                      <p className="text-sm text-muted-foreground">Avg Response Time</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-2xl font-bold" data-testid="text-success-rate">{performanceAnalytics.summary.successRate}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-2xl font-bold" data-testid="text-total-requests">{performanceAnalytics.summary.totalRequests}</p>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-2xl font-bold" data-testid="text-error-rate">{performanceAnalytics.summary.avgErrorRate}%</p>
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-2xl font-bold" data-testid="text-throughput">{performanceAnalytics.summary.avgThroughput}</p>
                      <p className="text-sm text-muted-foreground">Avg Throughput</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Response Time:</span>
                      <Badge variant={performanceAnalytics.trends.responseTimeTrend === 'improving' ? 'default' : performanceAnalytics.trends.responseTimeTrend === 'degrading' ? 'destructive' : 'secondary'}>
                        {performanceAnalytics.trends.responseTimeTrend}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Error Rate:</span>
                      <Badge variant={performanceAnalytics.trends.errorRateTrend === 'improving' ? 'default' : performanceAnalytics.trends.errorRateTrend === 'degrading' ? 'destructive' : 'secondary'}>
                        {performanceAnalytics.trends.errorRateTrend}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Throughput:</span>
                      <Badge variant={performanceAnalytics.trends.throughputTrend === 'increasing' ? 'default' : performanceAnalytics.trends.throughputTrend === 'decreasing' ? 'destructive' : 'secondary'}>
                        {performanceAnalytics.trends.throughputTrend}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {performanceAnalytics.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Validation Rule Generator
                  </CardTitle>
                  <CardDescription>
                    Generate intelligent validation rules based on resource type and strictness level
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-resource-type-3">Resource Type</Label>
                    <Select value={validationResourceType} onValueChange={setValidationResourceType}>
                      <SelectTrigger id="ai-fhir-api-integration-resource-type-3" data-testid="select-validation-resource">
                        <SelectValue placeholder="Select resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Patient">Patient</SelectItem>
                        <SelectItem value="Observation">Observation</SelectItem>
                        <SelectItem value="Condition">Condition</SelectItem>
                        <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                        <SelectItem value="Encounter">Encounter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-strictness-level">Strictness Level</Label>
                    <Select value={validationStrictness} onValueChange={setValidationStrictness}>
                      <SelectTrigger id="ai-fhir-api-integration-strictness-level" data-testid="select-validation-strictness">
                        <SelectValue placeholder="Select strictness" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lenient">Lenient - Minimal required fields</SelectItem>
                        <SelectItem value="standard">Standard - Common requirements</SelectItem>
                        <SelectItem value="strict">Strict - Full compliance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full" 
                    data-testid="button-generate-validation"
                    disabled={!validationResourceType || !validationStrictness || generateValidationRulesMutation.isPending}
                    onClick={() => generateValidationRulesMutation.mutate({ resourceType: validationResourceType, strictness: validationStrictness })}
                  >
                    {generateValidationRulesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Generate Rules
                  </Button>
                  {validationResult && (
                    <div className="mt-4 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" data-testid="text-validation-resource">{validationResult.resourceType}</span>
                        <Badge variant="outline" data-testid="badge-validation-count">{validationResult.totalRules} rules</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{validationResult.noCdsCompliance}</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {validationResult.rules.slice(0, 5).map((rule) => (
                          <div key={rule.id} className="text-xs p-2 bg-background rounded border">
                            <span className="font-medium">{rule.name}</span>: {rule.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Transformation Rule Generator
                  </CardTitle>
                  <CardDescription>
                    Generate data transformation rules for different target formats
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-source-resource-type">Source Resource Type</Label>
                    <Select value={transformResourceType} onValueChange={setTransformResourceType}>
                      <SelectTrigger id="ai-fhir-api-integration-source-resource-type" data-testid="select-transform-resource">
                        <SelectValue placeholder="Select resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Patient">Patient</SelectItem>
                        <SelectItem value="Observation">Observation</SelectItem>
                        <SelectItem value="Condition">Condition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-target-format">Target Format</Label>
                    <Select value={transformTargetFormat} onValueChange={setTransformTargetFormat}>
                      <SelectTrigger id="ai-fhir-api-integration-target-format" data-testid="select-target-format">
                        <SelectValue placeholder="Select target format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local System</SelectItem>
                        <SelectItem value="hl7v2">HL7 v2.x</SelectItem>
                        <SelectItem value="cda">CDA (C-CDA)</SelectItem>
                        <SelectItem value="custom">Custom Format</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full" 
                    data-testid="button-generate-transform"
                    disabled={!transformResourceType || !transformTargetFormat || generateTransformationRulesMutation.isPending}
                    onClick={() => generateTransformationRulesMutation.mutate({ resourceType: transformResourceType, targetFormat: transformTargetFormat })}
                  >
                    {generateTransformationRulesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Generate Transformations
                  </Button>
                  {transformResult && (
                    <div className="mt-4 p-3 border rounded-lg bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" data-testid="text-transform-resource">{transformResult.resourceType} → {transformResult.targetFormat}</span>
                        <Badge variant="outline" data-testid="badge-transform-count">{transformResult.totalRules} rules</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{transformResult.noCdsCompliance}</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {transformResult.rules.slice(0, 5).map((rule) => (
                          <div key={rule.id} className="text-xs p-2 bg-background rounded border">
                            <span className="font-medium">{rule.name}</span>: {rule.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Server Compatibility Analysis
                </CardTitle>
                <CardDescription>
                  Compare two discovered FHIR servers to analyze compatibility and get integration recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-first-server">First Server</Label>
                    <Select value={compatServer1} onValueChange={setCompatServer1}>
                      <SelectTrigger id="ai-fhir-api-integration-first-server" data-testid="select-server-1">
                        <SelectValue placeholder="Select first server" />
                      </SelectTrigger>
                      <SelectContent>
                        {discoveries.filter(d => d.status === 'active').map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.serverName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-fhir-api-integration-second-server">Second Server</Label>
                    <Select value={compatServer2} onValueChange={setCompatServer2}>
                      <SelectTrigger id="ai-fhir-api-integration-second-server" data-testid="select-server-2">
                        <SelectValue placeholder="Select second server" />
                      </SelectTrigger>
                      <SelectContent>
                        {discoveries.filter(d => d.status === 'active').map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.serverName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      className="w-full" 
                      data-testid="button-analyze-compatibility"
                      disabled={!compatServer1 || !compatServer2 || compatServer1 === compatServer2 || analyzeCompatibilityMutation.isPending}
                      onClick={() => analyzeCompatibilityMutation.mutate({ server1Id: compatServer1, server2Id: compatServer2 })}
                    >
                      {analyzeCompatibilityMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BarChart3 className="h-4 w-4 mr-2" />
                      )}
                      Analyze Compatibility
                    </Button>
                  </div>
                </div>
                
                {compatResult ? (
                  <div className="mt-6 p-4 border rounded-lg bg-muted/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm" data-testid="text-compat-servers">{compatResult.server1.name} ↔ {compatResult.server2.name}</p>
                        <p className="text-xs text-muted-foreground">{compatResult.commonResources.length} common resources</p>
                      </div>
                      <Badge variant="outline" data-testid="badge-compat-score">{compatResult.overallCompatibility}% compatible</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Recommendations:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {compatResult.recommendations.slice(0, 3).map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs text-muted-foreground">{compatResult.noCdsCompliance}</p>
                  </div>
                ) : (
                  <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground text-center">
                      Select two servers and click "Analyze Compatibility" to compare their capabilities, 
                      identify common resources, and get recommendations for integration.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  SMART on FHIR Configuration Discovery
                </CardTitle>
                <CardDescription>
                  Discover OAuth endpoints and SMART capabilities from a FHIR server's well-known configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {discoveries.filter(d => d.status === 'active').slice(0, 4).map((d) => (
                    <div key={d.id} className="border rounded-lg p-4" data-testid={`card-server-${d.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{d.serverName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>FHIR {d.fhirVersion}</p>
                        <p>{d.totalResources} resources</p>
                        <p>CORS: {d.security?.cors ? 'Yes' : 'No'}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3" 
                        data-testid={`button-smart-config-${d.id}`}
                        disabled={discoverSmartConfigMutation.isPending}
                        onClick={() => discoverSmartConfigMutation.mutate(d.id)}
                      >
                        {discoverSmartConfigMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Shield className="h-3 w-3 mr-1" />
                        )}
                        {smartConfigs[d.id] ? 'View Config' : 'Get SMART Config'}
                      </Button>
                      {smartConfigs[d.id] && (
                        <div className="mt-2 p-2 border rounded bg-muted/30 text-xs space-y-1">
                          <p data-testid={`text-smart-caps-${d.id}`}>{smartConfigs[d.id].capabilities.length} capabilities</p>
                          {smartConfigs[d.id].authorizationEndpoint && (
                            <p className="text-muted-foreground truncate">Auth: {smartConfigs[d.id].authorizationEndpoint}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedDiscovery && (
          <Dialog open={!!selectedDiscovery} onOpenChange={() => setSelectedDiscovery(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedDiscovery.status)}
                  {selectedDiscovery.serverName}
                </DialogTitle>
                <DialogDescription>{selectedDiscovery.baseUrl}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">FHIR Version</p>
                    <p className="font-medium">{selectedDiscovery.fhirVersion}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Publisher</p>
                    <p className="font-medium">{selectedDiscovery.publisher || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Discovered</p>
                    <p className="font-medium">{new Date(selectedDiscovery.discoveredAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{new Date(selectedDiscovery.lastUpdated).toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedDiscovery.security && (
                  <div>
                    <h4 className="font-medium mb-2">Security Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">CORS</p>
                        <Badge variant={selectedDiscovery.security.cors ? "default" : "secondary"}>
                          {selectedDiscovery.security.cors ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Services</p>
                        <div className="flex gap-1">
                          {selectedDiscovery.security.service?.map((s) => (
                            <Badge key={s} variant="outline">{s}</Badge>
                          )) || <span className="text-muted-foreground">None</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Supported Resources ({selectedDiscovery.capabilities.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedDiscovery.capabilities.map((cap) => (
                      <div key={cap.resourceType} className="border rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{cap.resourceType}</span>
                          <div className="flex gap-1">
                            {cap.versioning && <Badge variant="outline" className="text-xs">Versioned</Badge>}
                            {cap.readHistory && <Badge variant="outline" className="text-xs">History</Badge>}
                          </div>
                        </div>
                        <div className="text-sm">
                          <p className="text-muted-foreground">Interactions: {cap.interactions.join(', ')}</p>
                          <p className="text-muted-foreground">Search: {cap.searchParams.join(', ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
