import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Network, 
  Database, 
  ArrowRight,
  AlertTriangle, 
  CheckCircle, 
  Shield,
  Search,
  Loader2,
  Server,
  Zap,
  BarChart3,
  FileText,
  ExternalLink,
  Archive,
  Send,
  Bot,
  ChevronRight,
  Eye,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface LineageNode {
  id: string;
  name: string;
  displayName: string;
  type: string;
  description: string;
  system: string;
  domain?: string;
  sensitiveDataTypes: string[];
  riskLevel: string;
  complianceStatus: string;
  dataClassifications: string[];
  position?: { x: number; y: number };
}

interface LineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label: string;
  frequency: string;
  riskImpact: string;
  transformationDetails?: {
    name: string;
    description: string;
  };
}

interface LineageGraph {
  id: string;
  name: string;
  description: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    sourceSystemCount: number;
    dataStoreCount: number;
    transformationCount: number;
    avgPathLength: number;
    maxPathLength: number;
  };
  riskSummary: {
    overallRisk: string;
    highRiskPaths: Array<{ pathId: string; nodes: string[]; riskLevel: string; reason: string }>;
    riskFactors: Array<{ factor: string; severity: string; description: string }>;
    mitigationSuggestions: string[];
  };
  complianceSummary: {
    overallStatus: string;
    frameworks: Array<{ framework: string; status: string; score: number }>;
    violations: Array<{ id: string; policyName: string; nodeName: string; severity: string; description: string }>;
  };
}

interface ImpactAnalysis {
  targetNodeId: string;
  impactType: string;
  affectedNodes: Array<{ nodeId: string; nodeName: string; distance: number; impactLevel: string }>;
  riskAssessment: {
    overallRisk: string;
    riskFactors: Array<{ factor: string; severity: string; description: string }>;
    sensitiveDataExposure: string[];
  };
  recommendations: string[];
}

const nodeTypeIcons: Record<string, React.ReactNode> = {
  source_system: <Server className="w-4 h-4" />,
  data_store: <Database className="w-4 h-4" />,
  transformation: <Zap className="w-4 h-4" />,
  api_gateway: <Network className="w-4 h-4" />,
  analytics_engine: <BarChart3 className="w-4 h-4" />,
  reporting: <FileText className="w-4 h-4" />,
  external_system: <ExternalLink className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
};

const riskColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const complianceColors: Record<string, string> = {
  compliant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  non_compliant: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  review_needed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function DataLineagePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visualization");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string>("all");
  const [selectedRisk, setSelectedRisk] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [aiQuery, setAiQuery] = useState("");

  const { data: graphData, isLoading: graphLoading } = useQuery<{ success: boolean; data: LineageGraph }>({
    queryKey: ["/api/data-lineage/graph"],
  });

  const { data: systemsData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/data-lineage/filters/systems"],
  });

  const searchMutation = useMutation({
    mutationFn: async (filter: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/data-lineage/search", filter);
      return res.json();
    },
  });

  const impactMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const res = await fetch(`/api/data-lineage/nodes/${nodeId}/impact?direction=both`);
      return res.json();
    },
  });

  const aiAnalysisMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/data-lineage/analyze", { query });
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze lineage", variant: "destructive" });
    },
  });

  const graph = graphData?.data;
  const systems = systemsData?.data || [];

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    let nodes = graph.nodes;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n =>
        n.displayName.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.system.toLowerCase().includes(q)
      );
    }

    if (selectedSystem !== "all") {
      nodes = nodes.filter(n => n.system === selectedSystem);
    }

    if (selectedRisk !== "all") {
      nodes = nodes.filter(n => n.riskLevel === selectedRisk);
    }

    return nodes;
  }, [graph, searchQuery, selectedSystem, selectedRisk]);

  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return graph.edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
  }, [graph, filteredNodes]);

  const handleNodeClick = useCallback((node: LineageNode) => {
    setSelectedNode(node);
    impactMutation.mutate(node.id);
  }, [impactMutation]);

  const handleAiAnalysis = () => {
    if (!aiQuery.trim()) return;
    aiAnalysisMutation.mutate(aiQuery);
  };

  const impactData = impactMutation.data?.data as ImpactAnalysis | undefined;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Data Lineage Visualization</h1>
        <p className="text-muted-foreground">Trace data flow, analyze dependencies, and assess compliance impact</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="visualization" data-testid="tab-visualization">
            <Network className="w-4 h-4 mr-2" />
            Lineage Map
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Risk & Compliance
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <Bot className="w-4 h-4 mr-2" />
            AI Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualization">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-source-count">
                      {graph?.metrics.sourceSystemCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Source Systems</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-transform-count">
                      {graph?.metrics.transformationCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Transformations</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-store-count">
                      {graph?.metrics.dataStoreCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Data Stores</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-edge-count">
                      {graph?.metrics.totalEdges || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Data Flows</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Data Flow Diagram</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-48"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                    <SelectTrigger className="w-36" data-testid="select-system">
                      <SelectValue placeholder="System" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Systems</SelectItem>
                      {systems.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                    <SelectTrigger className="w-32" data-testid="select-risk">
                      <SelectValue placeholder="Risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risks</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {graphLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  <ScrollArea className="h-[500px] border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Nodes ({filteredNodes.length})</h3>
                    <div className="space-y-2">
                      {filteredNodes.map((node) => (
                        <div
                          key={node.id}
                          className={`p-3 border rounded-lg hover-elevate cursor-pointer ${
                            selectedNode?.id === node.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => handleNodeClick(node)}
                          data-testid={`node-${node.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {nodeTypeIcons[node.type] || <Database className="w-4 h-4" />}
                              <span className="font-medium">{node.displayName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge className={riskColors[node.riskLevel]} variant="outline">
                                {node.riskLevel}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{node.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="secondary" className="text-xs">{node.system}</Badge>
                            {node.sensitiveDataTypes.slice(0, 2).map((t) => (
                              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <ScrollArea className="h-[500px] border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Data Flows ({filteredEdges.length})</h3>
                    <div className="space-y-2">
                      {filteredEdges.map((edge) => {
                        const source = graph?.nodes.find(n => n.id === edge.sourceId);
                        const target = graph?.nodes.find(n => n.id === edge.targetId);
                        return (
                          <div key={edge.id} className="p-3 border rounded-lg" data-testid={`edge-${edge.id}`}>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{source?.displayName || edge.sourceId}</span>
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{target?.displayName || edge.targetId}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{edge.type}</Badge>
                              <Badge className={`${riskColors[edge.riskImpact]} text-xs`}>{edge.riskImpact}</Badge>
                              <span className="text-xs text-muted-foreground">{edge.frequency}</span>
                            </div>
                            {edge.transformationDetails && (
                              <p className="text-xs text-muted-foreground mt-1">{edge.transformationDetails.name}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedNode && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {nodeTypeIcons[selectedNode.type]}
                    <div>
                      <CardTitle>{selectedNode.displayName}</CardTitle>
                      <CardDescription>{selectedNode.system}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={riskColors[selectedNode.riskLevel]}>{selectedNode.riskLevel} risk</Badge>
                    <Badge className={complianceColors[selectedNode.complianceStatus]}>
                      {selectedNode.complianceStatus.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Details</h4>
                    <p className="text-sm text-muted-foreground mb-4">{selectedNode.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Type</span>
                        <span className="capitalize">{selectedNode.type.replace("_", " ")}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Domain</span>
                        <span className="capitalize">{(selectedNode.domain || "N/A").replace("_", " ")}</span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Data Classifications</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedNode.dataClassifications.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Impact Analysis</h4>
                    {impactMutation.isPending ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing impact...
                      </div>
                    ) : impactData ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm">Overall Risk: </span>
                          <Badge className={riskColors[impactData.riskAssessment.overallRisk]}>
                            {impactData.riskAssessment.overallRisk}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Affected Systems: {impactData.affectedNodes.length}</span>
                          <div className="mt-1 space-y-1">
                            {impactData.affectedNodes.slice(0, 5).map((a) => (
                              <div key={a.nodeId} className="flex items-center justify-between text-xs">
                                <span>{a.nodeName}</span>
                                <Badge variant="outline" className={riskColors[a.impactLevel]}>{a.impactLevel}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                        {impactData.recommendations.length > 0 && (
                          <div>
                            <span className="text-sm font-medium">Recommendations</span>
                            <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                              {impactData.recommendations.slice(0, 3).map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risk">
          {graph && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Overall Risk</p>
                        <Badge className={`${riskColors[graph.riskSummary.overallRisk]} text-lg mt-1`}>
                          {graph.riskSummary.overallRisk.toUpperCase()}
                        </Badge>
                      </div>
                      <AlertTriangle className={`w-10 h-10 ${
                        graph.riskSummary.overallRisk === "critical" ? "text-red-500" :
                        graph.riskSummary.overallRisk === "high" ? "text-orange-500" : "text-yellow-500"
                      }`} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Compliance Status</p>
                        <Badge className={`${complianceColors[graph.complianceSummary.overallStatus]} text-lg mt-1`}>
                          {graph.complianceSummary.overallStatus.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      {graph.complianceSummary.overallStatus === "compliant" ? (
                        <CheckCircle className="w-10 h-10 text-green-500" />
                      ) : (
                        <AlertCircle className="w-10 h-10 text-yellow-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Violations</p>
                        <p className="text-2xl font-bold mt-1">{graph.complianceSummary.violations.length}</p>
                      </div>
                      <Shield className="w-10 h-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Factors</CardTitle>
                    <CardDescription>Identified risks in the data lineage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {graph.riskSummary.riskFactors.map((factor, i) => (
                        <div key={i} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{factor.factor}</span>
                            <Badge className={riskColors[factor.severity]}>{factor.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{factor.description}</p>
                        </div>
                      ))}
                      {graph.riskSummary.riskFactors.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No significant risk factors identified</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Frameworks</CardTitle>
                    <CardDescription>Regulatory compliance status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {graph.complianceSummary.frameworks.map((fw) => (
                        <div key={fw.framework} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{fw.framework}</span>
                            <Badge className={complianceColors[fw.status]}>{fw.status.replace("_", " ")}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${fw.score >= 90 ? "bg-green-500" : fw.score >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${fw.score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{fw.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {graph.complianceSummary.violations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Policy Violations</CardTitle>
                    <CardDescription>Issues requiring attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {graph.complianceSummary.violations.map((violation) => (
                        <div key={violation.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              <span className="font-medium">{violation.policyName}</span>
                            </div>
                            <Badge className={riskColors[violation.severity]}>{violation.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{violation.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">Affected: {violation.nodeName}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Mitigation Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {graph.riskSummary.mitigationSuggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Lineage Analysis
              </CardTitle>
              <CardDescription>
                Ask questions about data lineage, dependencies, and compliance impact
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 mb-4">
                {aiAnalysisMutation.data?.data ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="font-medium mb-2">Your Question:</p>
                      <p className="text-muted-foreground">{aiAnalysisMutation.data.data.query}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="font-medium mb-2">Analysis:</p>
                      <p className="whitespace-pre-wrap">{aiAnalysisMutation.data.data.analysis}</p>
                    </div>
                    {aiAnalysisMutation.data.data.keyFindings.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Key Findings:</p>
                        <ul className="space-y-1">
                          {aiAnalysisMutation.data.data.keyFindings.map((finding: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiAnalysisMutation.data.data.recommendations.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {aiAnalysisMutation.data.data.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="mb-4">Ask me anything about the data lineage</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "What are the high-risk data flows?",
                        "How does patient data flow through the system?",
                        "What compliance issues exist?",
                      ].map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiQuery(q);
                            aiAnalysisMutation.mutate(q);
                          }}
                          data-testid={`button-suggestion-${q.slice(0, 10)}`}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {aiAnalysisMutation.isPending && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about data lineage, dependencies, compliance..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiAnalysis()}
                  disabled={aiAnalysisMutation.isPending}
                  data-testid="input-ai-query"
                />
                <Button
                  onClick={handleAiAnalysis}
                  disabled={!aiQuery.trim() || aiAnalysisMutation.isPending}
                  data-testid="button-analyze"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
