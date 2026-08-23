import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  GitBranch, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Database,
  ArrowRight,
  Loader2,
  FileText,
  Search,
  Server,
  Lock,
  Eye,
  BarChart3,
  TrendingUp,
  RefreshCw
} from "lucide-react";

interface ComplianceDashboard {
  summary: {
    totalAssessments: number;
    compliantResources: number;
    nonCompliantResources: number;
    partialCompliance: number;
    overallComplianceScore: number;
    pendingAssessments: number;
  };
  frameworkCompliance: {
    framework: string;
    compliantCount: number;
    totalCount: number;
    score: number;
    criticalFindings: number;
  }[];
  recentFindings: {
    requirementId: string;
    requirement: string;
    status: string;
    evidence: string;
    severity: string;
  }[];
  dataLineageSummary: {
    totalSources: number;
    totalTransformations: number;
    totalOutputs: number;
    activeFlows: number;
    riskAreas: number;
  };
  noCdsCompliance: string;
}

interface ComplianceRequirement {
  id: string;
  framework: string;
  requirement: string;
  description: string;
  category: string;
  applicableResourceTypes: string[];
  controlMeasures: string[];
  riskLevel: string;
}

interface DataLineageGraph {
  nodes: {
    id: string;
    nodeType: string;
    name: string;
    description: string;
    systemName: string;
  }[];
  edges: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    transformationType: string;
    dataFields: string[];
    status: string;
  }[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    generatedAt: string;
  };
}

interface ImpactAnalysis {
  id: string;
  analysisType: string;
  targetNodeName: string;
  analysisDate: string;
  impactedNodes: {
    nodeId: string;
    nodeName: string;
    impactLevel: string;
    impactDescription: string;
  }[];
  riskAssessment: {
    overallRisk: string;
    dataLossRisk: string;
    complianceRisk: string;
    operationalRisk: string;
  };
  recommendations: string[];
  aiInsights?: string;
}

interface ComplianceAssessment {
  id: string;
  resourceId: string;
  resourceType: string;
  assessmentDate: string;
  complianceStatus: string;
  overallScore: number;
  frameworkResults: {
    framework: string;
    compliant: boolean;
    score: number;
    findings: {
      requirementId: string;
      requirement: string;
      status: string;
      severity: string;
    }[];
  }[];
  recommendations: string[];
}

export default function AIFHIRDataGovernance() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [assessResourceId, setAssessResourceId] = useState("");
  const [assessResourceType, setAssessResourceType] = useState("Patient");
  const [assessResourceData, setAssessResourceData] = useState("");

  const { data: complianceDashboard, isLoading: dashboardLoading } = useQuery<ComplianceDashboard>({
    queryKey: ['/api/data-governance/compliance/dashboard']
  });

  const { data: requirements } = useQuery<{ items: ComplianceRequirement[] }>({
    queryKey: ['/api/data-governance/compliance/requirements']
  });

  const { data: lineageGraph, isLoading: lineageLoading } = useQuery<DataLineageGraph>({
    queryKey: ['/api/data-governance/lineage/graph']
  });

  const { data: impactAnalyses } = useQuery<{ items: ImpactAnalysis[] }>({
    queryKey: ['/api/data-governance/impact/analyses']
  });

  const { data: assessments } = useQuery<{ items: ComplianceAssessment[] }>({
    queryKey: ['/api/data-governance/compliance/assessments']
  });

  const assessComplianceMutation = useMutation({
    mutationFn: async (data: { resourceId: string; resourceType: string; resourceData: Record<string, unknown> }) => {
      const response = await apiRequest('POST', '/api/data-governance/compliance/assess', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-governance/compliance/assessments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/data-governance/compliance/dashboard'] });
      toast({ title: "Compliance Assessment Complete", description: "Resource has been assessed against compliance frameworks" });
      setAssessResourceId("");
      setAssessResourceData("");
    },
    onError: () => {
      toast({ title: "Assessment Failed", description: "Could not complete compliance assessment", variant: "destructive" });
    }
  });

  const analyzeImpactMutation = useMutation({
    mutationFn: async (data: { nodeId: string; analysisType: string }) => {
      const response = await apiRequest('POST', '/api/data-governance/impact/analyze', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-governance/impact/analyses'] });
      toast({ title: "Impact Analysis Complete", description: "Analysis has been generated" });
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not complete impact analysis", variant: "destructive" });
    }
  });

  const handleAssessCompliance = () => {
    if (!assessResourceId || !assessResourceData) {
      toast({ title: "Missing Fields", description: "Please provide resource ID and data", variant: "destructive" });
      return;
    }
    try {
      const resourceData = JSON.parse(assessResourceData);
      assessComplianceMutation.mutate({ resourceId: assessResourceId, resourceType: assessResourceType, resourceData });
    } catch {
      toast({ title: "Invalid JSON", description: "Resource data must be valid JSON", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'pass':
        return <Badge variant="default">Compliant</Badge>;
      case 'non_compliant':
      case 'fail':
        return <Badge variant="destructive">Non-Compliant</Badge>;
      case 'partial':
      case 'warning':
        return <Badge variant="secondary">Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'source':
        return <Database className="h-4 w-4" />;
      case 'transformation':
        return <RefreshCw className="h-4 w-4" />;
      case 'storage':
        return <Server className="h-4 w-4" />;
      case 'output':
        return <Eye className="h-4 w-4" />;
      default:
        return <GitBranch className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            AI FHIR Data Governance
          </h1>
          <p className="text-muted-foreground">
            AI-powered compliance classification, data lineage tracking, and impact analysis
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <Shield className="h-4 w-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="lineage" data-testid="tab-lineage">
            <GitBranch className="h-4 w-4 mr-2" />
            Lineage
          </TabsTrigger>
          <TabsTrigger value="impact" data-testid="tab-impact">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Impact
          </TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">
            <FileText className="h-4 w-4 mr-2" />
            Assessments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Overall Compliance Score</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-compliance-score">
                      {complianceDashboard?.summary.overallComplianceScore || 0}%
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Compliant Resources</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2" data-testid="text-compliant-count">
                      <CheckCircle className="h-5 w-5 text-foreground" />
                      {complianceDashboard?.summary.compliantResources || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Non-Compliant</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2" data-testid="text-non-compliant-count">
                      <XCircle className="h-5 w-5 text-destructive" />
                      {complianceDashboard?.summary.nonCompliantResources || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Data Flows</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2" data-testid="text-active-flows">
                      <Activity className="h-5 w-5" />
                      {complianceDashboard?.dataLineageSummary.activeFlows || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Framework Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {complianceDashboard?.frameworkCompliance.map((fc) => (
                        <div key={fc.framework} className="flex items-center justify-between p-3 border rounded-md" data-testid={`framework-${fc.framework}`}>
                          <div className="flex items-center gap-3">
                            <Lock className="h-4 w-4" />
                            <div>
                              <p className="font-medium">{fc.framework}</p>
                              <p className="text-sm text-muted-foreground">
                                {fc.compliantCount}/{fc.totalCount} compliant
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{fc.score}%</span>
                            {fc.criticalFindings > 0 && (
                              <Badge variant="destructive">{fc.criticalFindings} critical</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!complianceDashboard?.frameworkCompliance || complianceDashboard.frameworkCompliance.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No framework data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Data Lineage Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border rounded-md text-center">
                        <Database className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-2xl font-bold" data-testid="text-sources-count">
                          {complianceDashboard?.dataLineageSummary.totalSources || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Data Sources</p>
                      </div>
                      <div className="p-3 border rounded-md text-center">
                        <RefreshCw className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-2xl font-bold" data-testid="text-transforms-count">
                          {complianceDashboard?.dataLineageSummary.totalTransformations || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Transformations</p>
                      </div>
                      <div className="p-3 border rounded-md text-center">
                        <Eye className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-2xl font-bold" data-testid="text-outputs-count">
                          {complianceDashboard?.dataLineageSummary.totalOutputs || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Outputs</p>
                      </div>
                      <div className="p-3 border rounded-md text-center">
                        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-2xl font-bold" data-testid="text-risk-areas">
                          {complianceDashboard?.dataLineageSummary.riskAreas || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">Risk Areas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {complianceDashboard?.recentFindings && complianceDashboard.recentFindings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Recent Findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {complianceDashboard.recentFindings.slice(0, 5).map((finding, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-md" data-testid={`finding-${idx}`}>
                          <div>
                            <p className="font-medium">{finding.requirement}</p>
                            <p className="text-sm text-muted-foreground">{finding.evidence}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(finding.status)}
                            {getRiskBadge(finding.severity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Requirements
              </CardTitle>
              <CardDescription>
                HIPAA, GDPR, and other regulatory requirements for FHIR data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requirements?.items.map((req) => (
                  <div key={req.id} className="p-4 border rounded-md" data-testid={`requirement-${req.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{req.framework}</Badge>
                        <span className="font-medium">{req.requirement}</span>
                      </div>
                      {getRiskBadge(req.riskLevel)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{req.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{req.category}</Badge>
                      {req.applicableResourceTypes.slice(0, 3).map((rt) => (
                        <Badge key={rt} variant="outline">{rt}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {(!requirements?.items || requirements.items.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No requirements configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Assess Resource Compliance
              </CardTitle>
              <CardDescription>
                Run AI-powered compliance assessment on FHIR resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-governance-resource-id">Resource ID</Label>
                  <Input id="ai-fhir-data-governance-resource-id"
                    placeholder="Enter resource ID"
                    value={assessResourceId}
                    onChange={(e) => setAssessResourceId(e.target.value)}
                    data-testid="input-resource-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-governance-resource-type">Resource Type</Label>
                  <Select value={assessResourceType} onValueChange={setAssessResourceType}>
                    <SelectTrigger id="ai-fhir-data-governance-resource-type" data-testid="select-resource-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Patient">Patient</SelectItem>
                      <SelectItem value="Observation">Observation</SelectItem>
                      <SelectItem value="Condition">Condition</SelectItem>
                      <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                      <SelectItem value="Procedure">Procedure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-fhir-data-governance-resource-data-json">Resource Data (JSON)</Label>
                <Textarea id="ai-fhir-data-governance-resource-data-json"
                  placeholder='{"resourceType": "Patient", "id": "123", ...}'
                  value={assessResourceData}
                  onChange={(e) => setAssessResourceData(e.target.value)}
                  className="font-mono h-32"
                  data-testid="textarea-resource-data"
                />
              </div>
              <Button
                onClick={handleAssessCompliance}
                disabled={assessComplianceMutation.isPending}
                data-testid="button-assess-compliance"
              >
                {assessComplianceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Assess Compliance
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lineage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Data Lineage Graph
              </CardTitle>
              <CardDescription>
                Track data flow from source systems through transformations to outputs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lineageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{lineageGraph?.metadata.totalNodes || 0} Nodes</Badge>
                      <Badge variant="outline">{lineageGraph?.metadata.totalEdges || 0} Edges</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lineageGraph?.nodes.filter(n => n.nodeType === 'source').map((node) => (
                      <Card key={node.id} className="border-2" data-testid={`node-${node.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {getNodeIcon(node.nodeType)}
                            {node.name}
                          </CardTitle>
                          <Badge variant="default">Source</Badge>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">{node.description}</p>
                          <p className="text-xs mt-1">{node.systemName}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="h-8 w-8 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lineageGraph?.nodes.filter(n => n.nodeType === 'transformation' || n.nodeType === 'storage').map((node) => (
                      <Card key={node.id} className="border-2" data-testid={`node-${node.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {getNodeIcon(node.nodeType)}
                            {node.name}
                          </CardTitle>
                          <Badge variant="secondary">{node.nodeType}</Badge>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">{node.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="h-8 w-8 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lineageGraph?.nodes.filter(n => n.nodeType === 'output').map((node) => (
                      <Card key={node.id} className="border-2" data-testid={`node-${node.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {getNodeIcon(node.nodeType)}
                            {node.name}
                          </CardTitle>
                          <Badge variant="outline">Output</Badge>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">{node.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Data Flows</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {lineageGraph?.edges.map((edge) => {
                          const sourceNode = lineageGraph.nodes.find(n => n.id === edge.sourceNodeId);
                          const targetNode = lineageGraph.nodes.find(n => n.id === edge.targetNodeId);
                          return (
                            <div key={edge.id} className="flex items-center justify-between p-2 border rounded-md text-sm" data-testid={`edge-${edge.id}`}>
                              <div className="flex items-center gap-2">
                                <span>{sourceNode?.name || edge.sourceNodeId}</span>
                                <ArrowRight className="h-4 w-4" />
                                <span>{targetNode?.name || edge.targetNodeId}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{edge.transformationType}</Badge>
                                <Badge variant={edge.status === 'active' ? 'default' : 'outline'}>{edge.status}</Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Impact Analysis
              </CardTitle>
              <CardDescription>
                Analyze the impact of changes to data sources and transformations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-fhir-data-governance-select-node">Select Node</Label>
                  <Select value={selectedNode} onValueChange={setSelectedNode}>
                    <SelectTrigger id="ai-fhir-data-governance-select-node" data-testid="select-impact-node">
                      <SelectValue placeholder="Select a node to analyze" />
                    </SelectTrigger>
                    <SelectContent>
                      {lineageGraph?.nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Analysis Type</FieldCaption>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => selectedNode && analyzeImpactMutation.mutate({ nodeId: selectedNode, analysisType: 'change_impact' })}
                      disabled={!selectedNode || analyzeImpactMutation.isPending}
                      data-testid="button-change-impact"
                    >
                      Change Impact
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => selectedNode && analyzeImpactMutation.mutate({ nodeId: selectedNode, analysisType: 'deletion_impact' })}
                      disabled={!selectedNode || analyzeImpactMutation.isPending}
                      data-testid="button-deletion-impact"
                    >
                      Deletion Impact
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Analysis History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {impactAnalyses?.items.map((analysis) => (
                  <div key={analysis.id} className="p-4 border rounded-md" data-testid={`analysis-${analysis.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{analysis.analysisType.replace('_', ' ')}</Badge>
                        <span className="font-medium">{analysis.targetNodeName}</span>
                      </div>
                      {getRiskBadge(analysis.riskAssessment.overallRisk)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Data Loss: </span>
                        {getRiskBadge(analysis.riskAssessment.dataLossRisk)}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Compliance: </span>
                        {getRiskBadge(analysis.riskAssessment.complianceRisk)}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Operational: </span>
                        {getRiskBadge(analysis.riskAssessment.operationalRisk)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {analysis.impactedNodes.length} nodes impacted
                    </p>
                    {analysis.aiInsights && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded">{analysis.aiInsights}</p>
                    )}
                  </div>
                ))}
                {(!impactAnalyses?.items || impactAnalyses.items.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No impact analyses yet. Select a node above to analyze.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance Assessments
              </CardTitle>
              <CardDescription>
                History of compliance assessments across FHIR resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assessments?.items.map((assessment) => (
                  <div key={assessment.id} className="p-4 border rounded-md" data-testid={`assessment-${assessment.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{assessment.resourceType}</Badge>
                        <span className="font-medium">{assessment.resourceId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{assessment.overallScore}%</span>
                        {getStatusBadge(assessment.complianceStatus)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {assessment.frameworkResults.map((fr) => (
                        <div key={fr.framework} className="flex items-center gap-1">
                          <Badge variant={fr.compliant ? "default" : "destructive"}>
                            {fr.framework}: {fr.score}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {assessment.recommendations.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Recommendations: </span>
                        {assessment.recommendations.slice(0, 2).join('; ')}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Assessed: {new Date(assessment.assessmentDate).toLocaleString()}
                    </p>
                  </div>
                ))}
                {(!assessments?.items || assessments.items.length === 0) && (
                  <p className="text-muted-foreground text-center py-4">No assessments yet. Use the Compliance tab to assess resources.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
